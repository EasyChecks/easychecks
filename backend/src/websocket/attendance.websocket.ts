import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { attendanceService } from '../services/attendance.service.js';
import { shiftService } from '../services/shift.service.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  employeeId?: string;
  role?: string;
}

interface CheckInMessage {
  type: 'check-in';
  shiftId?: number;
  locationId?: number;
  latitude: number;
  longitude: number;
  photo?: string; // Base64 encoded image
}

interface CheckOutMessage {
  type: 'check-out';
  attendanceId: number;
  latitude: number;
  longitude: number;
  photo?: string;
}

interface ErrorResponse {
  type: 'error';
  message: string;
  code?: string;
}

interface SuccessResponse {
  type: 'success';
  message: string;
  data?: any;
}

export function setupAttendanceWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws/attendance'
  });

  // Handle HTTP upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    
    if (pathname === '/ws/attendance') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('📡 New WebSocket connection');

    // Parse authentication from query params (e.g., ?userId=1&employeeId=SA001&role=USER)
    const { query } = parse(request.url || '', true);
    const userId = query.userId ? parseInt(query.userId as string) : undefined;
    const employeeId = query.employeeId as string;
    const role = query.role as string;

    if (!userId || !employeeId || !role) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Authentication required. Please provide userId, employeeId, and role',
        code: 'AUTH_REQUIRED'
      } as ErrorResponse));
      ws.close();
      return;
    }

    ws.userId = userId;
    ws.employeeId = employeeId;
    ws.role = role;

    console.log(`✅ User ${employeeId} (${role}) connected`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: `Welcome ${employeeId}! You are connected to real-time attendance system.`,
      userId,
      employeeId,
      role
    }));

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'check-in':
            await handleCheckIn(ws, message as CheckInMessage);
            break;
            
          case 'check-out':
            await handleCheckOut(ws, message as CheckOutMessage);
            break;
            
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;
            
          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${message.type}`,
              code: 'UNKNOWN_TYPE'
            } as ErrorResponse));
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          code: 'PROCESSING_ERROR'
        } as ErrorResponse));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 User ${employeeId} disconnected`);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${employeeId}:`, error);
    });
  });

  return wss;
}

async function handleCheckIn(ws: AuthenticatedWebSocket, message: CheckInMessage) {
  try {
    if (!ws.userId) {
      throw new Error('User not authenticated');
    }

    // 1. ตรวจสอบว่ามี shift วันนี้หรือไม่
    const shiftsToday = await shiftService.getActiveShiftsForToday(ws.userId);
    
    if (shiftsToday.length === 0) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'คุณไม่มีกะงานสำหรับวันนี้',
        code: 'NO_SHIFT_TODAY'
      } as ErrorResponse));
      return;
    }

    // 2. ถ้าไม่ระบุ shiftId ใช้ shift แรก
    const shift = message.shiftId 
      ? shiftsToday.find(s => s.shiftId === message.shiftId)
      : shiftsToday[0];

    if (!shift) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'ไม่พบกะงานที่ระบุ',
        code: 'SHIFT_NOT_FOUND'
      } as ErrorResponse));
      return;
    }

    // 3. ใช้ locationId จาก shift หรือจากที่ส่งมา
    const locationId = message.locationId || shift.locationId;

    if (!locationId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'ไม่พบข้อมูลสถานที่',
        code: 'LOCATION_REQUIRED'
      } as ErrorResponse));
      return;
    }

    // 4. เรียก service เพื่อ check-in
    const result = await attendanceService.checkIn({
      userId: ws.userId,
      shiftId: shift.shiftId,
      locationId,
      latitude: message.latitude,
      longitude: message.longitude,
      photo: message.photo
    });

    // 5. ส่งผลลัพธ์กลับ
    ws.send(JSON.stringify({
      type: 'check-in-success',
      message: 'เข้างานสำเร็จ',
      data: result
    } as SuccessResponse));

    // Broadcast to admins (optional - for real-time monitoring)
    broadcastToAdmins(ws, {
      type: 'attendance-update',
      action: 'check-in',
      employeeId: ws.employeeId,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Check-in error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message || 'เข้างานไม่สำเร็จ',
      code: 'CHECK_IN_FAILED'
    } as ErrorResponse));
  }
}

async function handleCheckOut(ws: AuthenticatedWebSocket, message: CheckOutMessage) {
  try {
    if (!ws.userId) {
      throw new Error('User not authenticated');
    }

    // เรียก service เพื่อ check-out
    const result = await attendanceService.checkOut({
      attendanceId: message.attendanceId,
      userId: ws.userId,
      latitude: message.latitude,
      longitude: message.longitude,
      photo: message.photo
    });

    ws.send(JSON.stringify({
      type: 'check-out-success',
      message: 'ออกงานสำเร็จ',
      data: result
    } as SuccessResponse));

    // Broadcast to admins
    broadcastToAdmins(ws, {
      type: 'attendance-update',
      action: 'check-out',
      employeeId: ws.employeeId,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Check-out error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message || 'ออกงานไม่สำเร็จ',
      code: 'CHECK_OUT_FAILED'
    } as ErrorResponse));
  }
}

function broadcastToAdmins(currentWs: AuthenticatedWebSocket, message: any) {
  // ส่งข้อความไปหา admins ที่เชื่อมต่ออยู่
  // จะต้องเก็บ clients ไว้ใน Map หรือ Set
  // ตอนนี้ข้ามไปก่อน - จะเพิ่มในอนาคต
}
