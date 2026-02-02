import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  employeeId?: string;
  role?: string;
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

// Store active subscriptions
const leaveSubscriptions = new Map<number, Set<AuthenticatedWebSocket>>();

export function setupLeaveRequestWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws/leave-requests'
  });

  // Handle HTTP upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    
    if (pathname === '/ws/leave-requests') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('📡 New Leave Request WebSocket connection');

    // Parse authentication from query params
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

    console.log(`✅ User ${employeeId} (${role}) connected to Leave Request WebSocket`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: `Welcome ${employeeId}! You are connected to real-time leave request system.`,
      userId,
      employeeId,
      role
    }));

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'watch-leave-requests':
            await handleLeaveRequestsWatch(ws, message);
            break;
            
          case 'unwatch-leave-requests':
            await handleLeaveRequestsUnwatch(ws, message);
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
        console.error('❌ Error processing leave request message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          code: 'PROCESSING_ERROR'
        } as ErrorResponse));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 User ${employeeId} disconnected from Leave Request WebSocket`);
      // Remove subscriptions when disconnected
      for (const [userId, subscribers] of leaveSubscriptions.entries()) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          leaveSubscriptions.delete(userId);
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Leave Request WebSocket error for ${employeeId}:`, error);
    });
  });

  return wss;
}

async function handleLeaveRequestsWatch(ws: AuthenticatedWebSocket, message: any) {
  try {
    if (!ws.userId) {
      throw new Error('User not authenticated');
    }

    const { targetUserId } = message;
    const userToWatch = targetUserId || ws.userId;

    // Admins can watch any user, users can only watch themselves
    if (userToWatch !== ws.userId && ws.role !== 'ADMIN') {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'You can only watch your own leave requests',
        code: 'PERMISSION_DENIED'
      } as ErrorResponse));
      return;
    }

    // Add to subscription
    if (!leaveSubscriptions.has(userToWatch)) {
      leaveSubscriptions.set(userToWatch, new Set());
    }
    leaveSubscriptions.get(userToWatch)?.add(ws);

    ws.send(JSON.stringify({
      type: 'success',
      message: `Watching leave requests for user ${userToWatch}`,
      data: { watchingUserId: userToWatch }
    } as SuccessResponse));

    console.log(`✅ User ${ws.employeeId} watching leave requests for user ${userToWatch}`);

  } catch (error: any) {
    console.error('❌ Leave requests watch error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message || 'Failed to watch leave requests',
      code: 'WATCH_FAILED'
    } as ErrorResponse));
  }
}

async function handleLeaveRequestsUnwatch(ws: AuthenticatedWebSocket, message: any) {
  try {
    const { targetUserId } = message;
    const userToUnwatch = targetUserId || ws.userId;

    if (!leaveSubscriptions.has(userToUnwatch)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not watching this user\'s leave requests',
        code: 'NOT_WATCHING'
      } as ErrorResponse));
      return;
    }

    leaveSubscriptions.get(userToUnwatch)?.delete(ws);
    if (leaveSubscriptions.get(userToUnwatch)?.size === 0) {
      leaveSubscriptions.delete(userToUnwatch);
    }

    ws.send(JSON.stringify({
      type: 'success',
      message: `Stopped watching leave requests for user ${userToUnwatch}`,
    } as SuccessResponse));

    console.log(`✅ User ${ws.employeeId} stopped watching user ${userToUnwatch}`);

  } catch (error: any) {
    console.error('❌ Leave requests unwatch error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message || 'Failed to unwatch leave requests',
      code: 'UNWATCH_FAILED'
    } as ErrorResponse));
  }
}

/**
 * Broadcast leave request updates to all watchers
 * Usage: broadcastLeaveRequestUpdate(userId, 'created', leaveRequestData)
 */
export function broadcastLeaveRequestUpdate(userId: number, action: string, data: any) {
  const watchers = leaveSubscriptions.get(userId);
  
  if (!watchers || watchers.size === 0) {
    return;
  }

  const message = {
    type: 'leave-request-update',
    userId,
    action,
    data,
    timestamp: new Date().toISOString()
  };

  watchers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });

  console.log(`📢 Broadcasted leave request update for user ${userId} to ${watchers.size} watchers`);
}

/**
 * Broadcast to all admins watching leave requests
 */
export function broadcastToLeaveRequestAdmins(message: any) {
  let adminCount = 0;

  for (const watchers of leaveSubscriptions.values()) {
    watchers.forEach((ws) => {
      if (ws.role === 'ADMIN' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        adminCount++;
      }
    });
  }

  if (adminCount > 0) {
    console.log(`📢 Broadcasted admin message to ${adminCount} admins`);
  }
}
