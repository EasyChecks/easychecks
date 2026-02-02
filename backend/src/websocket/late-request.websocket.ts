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
const lateSubscriptions = new Map<number, Set<AuthenticatedWebSocket>>();

export function setupLateRequestWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws/late-requests'
  });

  // Handle HTTP upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    
    if (pathname === '/ws/late-requests') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('📡 New Late Request WebSocket connection');

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

    console.log(`✅ User ${employeeId} (${role}) connected to Late Request WebSocket`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: `Welcome ${employeeId}! You are connected to real-time late request system.`,
      userId,
      employeeId,
      role
    }));

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'watch-late-requests':
            await handleLateRequestsWatch(ws, message);
            break;
            
          case 'unwatch-late-requests':
            await handleLateRequestsUnwatch(ws, message);
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
        console.error('❌ Error processing late request message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          code: 'PROCESSING_ERROR'
        } as ErrorResponse));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 User ${employeeId} disconnected from Late Request WebSocket`);
      // Remove subscriptions when disconnected
      for (const [userId, subscribers] of lateSubscriptions.entries()) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          lateSubscriptions.delete(userId);
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Late Request WebSocket error for ${employeeId}:`, error);
    });
  });

  return wss;
}

async function handleLateRequestsWatch(ws: AuthenticatedWebSocket, message: any) {
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
        message: 'You can only watch your own late requests',
        code: 'PERMISSION_DENIED'
      } as ErrorResponse));
      return;
    }

    // Add to subscription
    if (!lateSubscriptions.has(userToWatch)) {
      lateSubscriptions.set(userToWatch, new Set());
    }
    lateSubscriptions.get(userToWatch)?.add(ws);

    ws.send(JSON.stringify({
      type: 'success',
      message: `Watching late requests for user ${userToWatch}`,
      data: { watchingUserId: userToWatch }
    } as SuccessResponse));

    console.log(`✅ User ${ws.employeeId} watching late requests for user ${userToWatch}`);

  } catch (error: any) {
    console.error('❌ Late requests watch error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message || 'Failed to watch late requests',
      code: 'WATCH_FAILED'
    } as ErrorResponse));
  }
}

async function handleLateRequestsUnwatch(ws: AuthenticatedWebSocket, message: any) {
  try {
    const { targetUserId } = message;
    const userToUnwatch = targetUserId || ws.userId;

    if (!lateSubscriptions.has(userToUnwatch)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not watching this user\'s late requests',
        code: 'NOT_WATCHING'
      } as ErrorResponse));
      return;
    }

    lateSubscriptions.get(userToUnwatch)?.delete(ws);
    if (lateSubscriptions.get(userToUnwatch)?.size === 0) {
      lateSubscriptions.delete(userToUnwatch);
    }

    ws.send(JSON.stringify({
      type: 'success',
      message: `Stopped watching late requests for user ${userToUnwatch}`,
    } as SuccessResponse));

    console.log(`✅ User ${ws.employeeId} stopped watching user ${userToUnwatch}`);

  } catch (error: any) {
    console.error('❌ Late requests unwatch error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message || 'Failed to unwatch late requests',
      code: 'UNWATCH_FAILED'
    } as ErrorResponse));
  }
}

/**
 * Broadcast late request updates to all watchers
 * Usage: broadcastLateRequestUpdate(userId, 'created', lateRequestData)
 */
export function broadcastLateRequestUpdate(userId: number, action: string, data: any) {
  const watchers = lateSubscriptions.get(userId);
  
  if (!watchers || watchers.size === 0) {
    return;
  }

  const message = {
    type: 'late-request-update',
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

  console.log(`📢 Broadcasted late request update for user ${userId} to ${watchers.size} watchers`);
}

/**
 * Broadcast to all admins watching late requests
 */
export function broadcastToLateRequestAdmins(message: any) {
  let adminCount = 0;

  for (const watchers of lateSubscriptions.values()) {
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
