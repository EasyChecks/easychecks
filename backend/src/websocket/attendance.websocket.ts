import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

/**
 * 📡 WebSocket Service - Real-time Data Polling
 * 
 * 🔴 หมายเหตุ: WebSocket นี้ใช้สำหรับ "รับข้อมูลแบบ real-time" เท่านั้น
 * - ไม่ใช่สำหรับ check-in/check-out (ให้ใช้ REST API แทน)
 * - ใช้สำหรับ broadcast ข้อมูลไปยัง clients หลังจากมีการ CUD (Create/Update/Delete)
 * 
 * Flow:
 * 1. Client connect มาที่ /ws/attendance
 * 2. Server ส่ง 'connected' message กลับ
 * 3. เมื่อมีการ CUD ผ่าน REST API, server จะ broadcast ไปยังทุก client
 * 4. Client รับข้อมูลและอัพเดต UI
 */

// ============================================
// 📦 Types - รูปแบบข้อมูล
// ============================================

// WebSocket ที่มีข้อมูล user (optional ตอนนี้ยังไม่มี auth)
interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;        // รหัสผู้ใช้
  employeeId?: string;    // รหัสพนักงาน
  role?: string;          // Role
  branchId?: number;      // สาขา
  isAlive?: boolean;      // สำหรับ heartbeat
}

// ประเภทข้อมูลที่จะ broadcast
type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT' | 'UPDATE' | 'DELETE';
type ShiftAction = 'CREATE' | 'UPDATE' | 'DELETE';

// ============================================
// 📡 Global Variables
// ============================================

// เก็บ WebSocket Server instance ไว้ใช้ broadcast
let wss: WebSocketServer | null = null;

// ============================================
// 🛠️ Helper Functions
// ============================================

/**
 * 📡 Broadcast message ไปยังทุก connected clients
 */
function broadcast(data: object) {
  if (!wss) {
    console.warn('⚠️ WebSocket server not initialized');
    return;
  }

  const message = JSON.stringify(data);
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * 💓 Heartbeat - ตรวจสอบว่า client ยังเชื่อมต่ออยู่
 */
function heartbeat(ws: AuthenticatedWebSocket) {
  ws.isAlive = true;
}

// ============================================
// 📋 Main Functions
// ============================================

/**
 * 🚀 Setup WebSocket Server
 * 
 * เรียกใช้ใน index.ts เพื่อ setup WebSocket
 */
export function setupAttendanceWebSocket(server: Server) {
  wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws/attendance'
  });

  // ===== Handle HTTP upgrade requests =====
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    
    if (pathname === '/ws/attendance') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request);
      });
    } else {
      // ปฏิเสธ connection ที่ไม่ใช่ /ws/attendance
      socket.destroy();
    }
  });

  // ===== Handle new connections =====
  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('📡 New WebSocket connection');

    // Parse query params (optional - ตอนนี้ยังไม่มี auth)
    // ตัวอย่าง: /ws/attendance?userId=1&employeeId=SA001&role=USER&branchId=1
    const { query } = parse(request.url || '', true);
    
    // เก็บข้อมูล user ไว้ใน ws object (ถ้ามี)
    if (query.userId) {
      ws.userId = parseInt(query.userId as string);
    }
    if (query.employeeId) {
      ws.employeeId = query.employeeId as string;
    }
    if (query.role) {
      ws.role = query.role as string;
    }
    if (query.branchId) {
      ws.branchId = parseInt(query.branchId as string);
    }

    // Setup heartbeat
    ws.isAlive = true;
    ws.on('pong', () => heartbeat(ws));

    // ===== ส่ง welcome message =====
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'เชื่อมต่อกับระบบ real-time สำเร็จ',
      timestamp: new Date().toISOString(),
      // ส่งข้อมูล user กลับไป (ถ้ามี)
      ...(ws.userId && { userId: ws.userId }),
      ...(ws.employeeId && { employeeId: ws.employeeId }),
      ...(ws.role && { role: ws.role }),
    }));

    console.log(`✅ Client connected ${ws.employeeId ? `(${ws.employeeId})` : ''}`);

    // ===== Handle incoming messages =====
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'ping':
            // ตอบ pong กลับ (heartbeat)
            ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: new Date().toISOString() 
            }));
            break;
            
          case 'subscribe':
            // TODO: สำหรับอนาคต - subscribe เฉพาะ channel ที่สนใจ
            // เช่น subscribe('attendance:branch:1')
            ws.send(JSON.stringify({ 
              type: 'subscribed', 
              channel: message.channel,
              message: `Subscribed to ${message.channel}` 
            }));
            break;
            
          default:
            // ไม่รับ message อื่นๆ (check-in/check-out ให้ใช้ REST API)
            ws.send(JSON.stringify({
              type: 'error',
              message: `ไม่รองรับ message type: ${message.type}. กรุณาใช้ REST API สำหรับ check-in/check-out`,
              code: 'USE_REST_API'
            }));
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'ไม่สามารถประมวลผล message ได้',
          code: 'PROCESSING_ERROR'
        }));
      }
    });

    // ===== Handle disconnect =====
    ws.on('close', () => {
      console.log(`🔌 Client disconnected ${ws.employeeId ? `(${ws.employeeId})` : ''}`);
    });

    // ===== Handle error =====
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error ${ws.employeeId ? `for ${ws.employeeId}` : ''}:`, error);
    });
  });

  // ===== Setup heartbeat interval =====
  // ตรวจสอบทุก 30 วินาทีว่า clients ยังเชื่อมต่ออยู่
  const interval = setInterval(() => {
    wss!.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        console.log('💀 Terminating inactive connection');
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('📡 WebSocket server initialized at /ws/attendance');

  return wss;
}

// ============================================
// 📡 Broadcast Functions - เรียกใช้หลัง CUD
// ============================================

/**
 * 📡 Broadcast การเปลี่ยนแปลง Attendance
 * 
 * เรียกใช้หลังจาก:
 * - Check-in (action: 'CHECK_IN')
 * - Check-out (action: 'CHECK_OUT')
 * - Update attendance (action: 'UPDATE')
 * - Delete attendance (action: 'DELETE')
 * 
 * @param action - ประเภทการกระทำ
 * @param data - ข้อมูล attendance (หรือ { attendanceId } สำหรับ DELETE)
 */
export function broadcastAttendanceUpdate(action: AttendanceAction, data: any) {
  broadcast({
    type: 'attendance_update',
    action,
    data,
    timestamp: new Date().toISOString(),
  });
  
  console.log(`📡 Broadcasted attendance ${action}`);
}

/**
 * 📡 Broadcast การเปลี่ยนแปลง Shift
 * 
 * เรียกใช้หลังจาก:
 * - Create shift (action: 'CREATE')
 * - Update shift (action: 'UPDATE')
 * - Delete shift (action: 'DELETE')
 * 
 * @param action - ประเภทการกระทำ
 * @param data - ข้อมูล shift (หรือ { shiftId, deleteReason } สำหรับ DELETE)
 */
export function broadcastShiftUpdate(action: ShiftAction, data: any) {
  broadcast({
    type: 'shift_update',
    action,
    data,
    timestamp: new Date().toISOString(),
  });
  
  console.log(`📡 Broadcasted shift ${action}`);
}

/**
 * 📡 Broadcast ข้อมูลทั่วไป
 * 
 * ใช้สำหรับ broadcast ข้อมูลอื่นๆ ที่ไม่ใช่ attendance/shift
 * 
 * @param type - ประเภทข้อมูล
 * @param data - ข้อมูล
 */
export function broadcastMessage(type: string, data: any) {
  broadcast({
    type,
    data,
    timestamp: new Date().toISOString(),
  });
  
  console.log(`📡 Broadcasted ${type}`);
}

// ============================================
// 📤 Export
// ============================================

export default {
  setupAttendanceWebSocket,
  broadcastAttendanceUpdate,
  broadcastShiftUpdate,
  broadcastMessage,
};
