import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { toThaiIso } from '../utils/timezone.js';

/**
 * 📡 Attendance WebSocket — real-time broadcast หลัง CUD
 *
 * ทำไมต้องมี WebSocket แยกจาก REST API?
 * REST API ตอบ 1 client ที่ขอ, WebSocket push ให้ *ทุก* client พร้อมกัน
 * → Admin เปิด Dashboard ไว้จะเห็นสถานะเปลี่ยนทันทีโดยไม่ต้อง refresh
 *
 * กฎสำคัญ: WebSocket ที่นี่เป็น "read-only push" เท่านั้น
 * - check-in / check-out / สร้างกะ → ผ่าน REST API เสมอ
 * - WebSocket รับแค่ ping/subscribe
 * - หลัง REST write สำเร็จ controller จะ broadcast ผ่านฟังก์ชันด้านล่าง
 *
 * Flow:
 *   Client เปิด /ws/attendance
 *     → server ส่ง 'connected'
 *   พนักงาน check-in ผ่าน POST /api/attendance/check-in
 *     → controller เรียก broadcastAttendanceUpdate('CHECK_IN', data)
 *     → ทุก client ที่ connect อยู่รับ message { type: 'attendance_update', action: 'CHECK_IN', data }
 */

// ============================================
// 📦 Types
// ============================================

// WebSocket ที่ extend ด้วยข้อมูล user จาก query string
// ทำไมไม่ใช้ Bearer token? WS upgrade request ไม่สะดวก attach header → ใช้ query แทน
interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;     // ?userId=1
  employeeId?: string; // ?employeeId=SA001
  role?: string;       // ?role=USER
  branchId?: number;   // ?branchId=1
  isAlive?: boolean;   // ใช้ heartbeat ตรวจว่ายัง alive ไหม
}

// action ของ attendance — controller ส่งมาใน broadcastAttendanceUpdate()
type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT' | 'UPDATE' | 'DELETE';
// action ของ shift — controller ส่งมาใน broadcastShiftUpdate()
type ShiftAction = 'CREATE' | 'UPDATE' | 'DELETE';
// action ของ user — user controller ส่งมาใน broadcastUserUpdate()
type UserAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_CREATE';

// ============================================
// 📡 State
// ============================================

// เก็บ WebSocketServer instance ไว้ global เพื่อให้ broadcast functions เข้าถึงได้
// ทำไม module-level? ทุก broadcast function อยู่ในไฟล์เดียวกัน → share state ได้โดยตรง
let wss: WebSocketServer | null = null;

// ============================================
// 🛠️ Internal Helpers
// ============================================

/**
 * broadcast() — ส่ง JSON message ไปยังทุก client ที่ OPEN อยู่
 * ทำไมตรวจ readyState === OPEN? client ที่กำลัง closing จะ throw ถ้า send
 */
function broadcast(data: object) {
  if (!wss) {
    console.warn('⚠️ WebSocket server not initialized'); // setupAttendanceWebSocket ยังไม่ถูกเรียก
    return;
  }

  const message = JSON.stringify(data); // serialize ครั้งเดียว ไม่ serialize ซ้ำทุก client

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) { // ส่งเฉพาะ client ที่ยัง connect อยู่
      client.send(message);
    }
  });
}

/**
 * heartbeat() — mark ws ว่า pong กลับมาแล้ว = ยัง alive
 * ถ้า 30s ผ่านไปแล้วไม่เคย pong → interval จะ terminate
 */
function heartbeat(ws: AuthenticatedWebSocket) {
  ws.isAlive = true; // reset ทุกครั้งที่ client ตอบ pong
}

// ============================================
// 🚀 Setup
// ============================================

/**
 * setupAttendanceWebSocket() — เรียกครั้งเดียวตอน server boot ใน index.ts
 *
 * ทำไมใช้ noServer: true + upgrade event แทน WebSocketServer({ server })?
 * เพื่อแยก path ได้ — /ws/attendance ผ่าน, path อื่น destroy
 * ถ้าใช้ { server } ตรง ๆ จะ accept ทุก path
 */
export function setupAttendanceWebSocket(server: Server) {
  wss = new WebSocketServer({
    noServer: true, // ไม่ bind กับ HTTP server โดยตรง → handle upgrade เอง
    path: '/ws/attendance',
  });

  // ===== Intercept HTTP upgrade (ws:// handshake) =====
  // HTTP server รับ upgrade request ก่อน → เราเลือกว่าจะ pass ให้ wss ไหม
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');

    if (pathname === '/ws/attendance') {
      // path ถูกต้อง → ส่งต่อให้ wss จัดการ handshake
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request); // trigger 'connection' event ด้านล่าง
      });
    } else {
      // path ไม่รู้จัก → ปิด socket ทันที ไม่ให้ค้างอยู่
      socket.destroy();
    }
  });

  // ===== Handle new client connection =====
  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('📡 New WebSocket connection');

    // อ่าน query string เพื่อรู้ว่าใคร connect มา
    // ตัวอย่าง URL: /ws/attendance?userId=1&employeeId=EMP001&role=USER&branchId=2
    const { query } = parse(request.url || '', true);

    // เก็บข้อมูล user ใน ws object เพื่อใช้ trace ใน log
    if (query.userId)     ws.userId     = parseInt(query.userId as string);
    if (query.employeeId) ws.employeeId = query.employeeId as string;
    if (query.role)       ws.role       = query.role as string;
    if (query.branchId)   ws.branchId   = parseInt(query.branchId as string);

    // mark alive = true ตั้งแต่แรก + ฟัง pong เพื่อ reset
    ws.isAlive = true;
    ws.on('pong', () => heartbeat(ws)); // pong คือ client ตอบ ping ที่ server ส่งไป

    // ===== Welcome message =====
    // บอก client ว่า connect สำเร็จ พร้อม echo ข้อมูล user กลับ
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'เชื่อมต่อกับระบบ real-time สำเร็จ',
      timestamp: toThaiIso(new Date()),
      ...(ws.userId     && { userId: ws.userId }),
      ...(ws.employeeId && { employeeId: ws.employeeId }),
      ...(ws.role       && { role: ws.role }),
    }));

    console.log(`✅ Client connected ${ws.employeeId ? `(${ws.employeeId})` : ''}`);

    // ===== Handle messages from client =====
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()); // client ส่ง JSON เสมอ

        switch (message.type) {
        case 'ping':
          // client ping มาเอง (ต่างจาก server ping ที่ใช้ heartbeat)
          ws.send(JSON.stringify({ type: 'pong', timestamp: toThaiIso(new Date()) }));
          break;

        case 'subscribe':
          // TODO อนาคต: กรองเฉพาะสาขาที่สนใจ เช่น subscribe('attendance:branch:1')
          // ตอนนี้ broadcast ไปทุก client อยู่แล้ว
          ws.send(JSON.stringify({
            type: 'subscribed',
            channel: message.channel,
            message: `Subscribed to ${message.channel}`,
          }));
          break;

        default:
          // check-in/check-out ต้องใช้ REST API เท่านั้น ไม่รับทาง WebSocket
          ws.send(JSON.stringify({
            type: 'error',
            message: `ไม่รองรับ message type: ${message.type}. กรุณาใช้ REST API สำหรับ check-in/check-out`,
            code: 'USE_REST_API',
          }));
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'ไม่สามารถประมวลผล message ได้', code: 'PROCESSING_ERROR' }));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 Client disconnected ${ws.employeeId ? `(${ws.employeeId})` : ''}`);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error ${ws.employeeId ? `for ${ws.employeeId}` : ''}:`, error);
    });
  });

  // ===== Heartbeat interval =====
  // ทำไมต้องมี heartbeat? TCP connection อาจดูเหมือน alive แต่ตายจริงแล้ว (zombie)
  // ทุก 30s: ส่ง ping ไปทุก client → ถ้าไม่มี pong กลับมา → terminate
  const interval = setInterval(() => {
    wss!.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        console.log('💀 Terminating inactive connection');
        return ws.terminate(); // ปิด connection ที่ตายแล้ว
      }
      ws.isAlive = false; // reset ก่อน ping → ถ้า pong กลับมา heartbeat() จะ set เป็น true
      ws.ping();
    });
  }, 30000); // 30 วินาที

  // ล้าง interval เมื่อ WebSocket server ปิด (ป้องกัน memory leak)
  wss.on('close', () => clearInterval(interval));

  console.log('📡 WebSocket server initialized at /ws/attendance');
  return wss;
}

// ============================================
// 📡 Broadcast Functions
// ============================================

/**
 * broadcastAttendanceUpdate() — เรียกจาก attendance.controller.ts หลัง write สำเร็จ
 *
 * เมื่อไหร่ที่เรียก:
 *   checkIn()        → broadcastAttendanceUpdate('CHECK_IN',  attendance)
 *   checkOut()       → broadcastAttendanceUpdate('CHECK_OUT', attendance)
 *   updateAttendance → broadcastAttendanceUpdate('UPDATE',    attendance)
 *   deleteAttendance → broadcastAttendanceUpdate('DELETE',    { attendanceId })
 *
 * Client ที่รับจะได้:
 *   { type: 'attendance_update', action: 'CHECK_IN', data: {...}, timestamp: '...' }
 */
export function broadcastAttendanceUpdate(action: AttendanceAction, data: unknown) {
  broadcast({
    type: 'attendance_update', // client filter ด้วย type นี้
    action,                    // CHECK_IN / CHECK_OUT / UPDATE / DELETE
    data,                      // attendance record หรือ { attendanceId } สำหรับ DELETE
    timestamp: toThaiIso(new Date()),
  });
  console.log(`📡 Broadcasted attendance ${action}`);
}

/**
 * broadcastShiftUpdate() — เรียกจาก shift.controller.ts หลัง write สำเร็จ
 *
 * เมื่อไหร่ที่เรียก:
 *   createShift() → broadcastShiftUpdate('CREATE', shift)
 *   updateShift() → broadcastShiftUpdate('UPDATE', shift)
 *   deleteShift() → broadcastShiftUpdate('DELETE', { shiftId, deleteReason })
 *
 * Client ที่รับจะได้:
 *   { type: 'shift_update', action: 'CREATE', data: {...}, timestamp: '...' }
 */
export function broadcastShiftUpdate(action: ShiftAction, data: unknown) {
  broadcast({
    type: 'shift_update', // client filter ด้วย type นี้
    action,               // CREATE / UPDATE / DELETE
    data,                 // shift record หรือ { shiftId } สำหรับ DELETE
    timestamp: toThaiIso(new Date()),
  });
  console.log(`📡 Broadcasted shift ${action}`);
}

/**
 * broadcastMessage() — broadcast ทั่วไป สำหรับ type อื่น ๆ
 * ตัวอย่าง: notification, announcement
 */
export function broadcastMessage(type: string, data: unknown) {
  broadcast({ type, data, timestamp: toThaiIso(new Date()) });
  console.log(`📡 Broadcasted ${type}`);
}

/**
 * broadcastUserUpdate() — เรียกจาก user.controller.ts หลัง write สำเร็จ
 *
 * เมื่อไหร่ที่เรียก:
 *   createUser()     → broadcastUserUpdate('CREATE',      user)
 *   updateUser()     → broadcastUserUpdate('UPDATE',      user)
 *   deleteUser()     → broadcastUserUpdate('DELETE',      { userId })
 *   bulkCreateUsers  → broadcastUserUpdate('BULK_CREATE', users[])
 */
export function broadcastUserUpdate(action: UserAction, data: unknown) {
  broadcast({
    type: 'user_update', // client filter ด้วย type นี้
    action,              // CREATE / UPDATE / DELETE / BULK_CREATE
    data,
    timestamp: toThaiIso(new Date()),
  });
  console.log(`📡 Broadcasted user ${action}`);
}

export default {
  setupAttendanceWebSocket,
  broadcastAttendanceUpdate,
  broadcastShiftUpdate,
  broadcastUserUpdate,
  broadcastMessage,
};
