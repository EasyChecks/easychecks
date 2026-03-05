import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { EventUserActions } from '../services/event.service.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  employeeId?: string;
  role?: string;
}

interface EventNotificationMessage {
  type: 'subscribe-event';
  eventId: number;
}

type EventAction = 'created' | 'updated' | 'deleted' | 'participant-joined' | 'participant-left';

interface EventUpdateMessage {
  type: 'event-update';
  eventId: number;
  action: EventAction;
  data: unknown;
}

interface ErrorResponse {
  type: 'error';
  message: string;
  code?: string;
}

interface SuccessResponse {
  type: 'success';
  message: string;
  data?: unknown;
}

// Store active subscriptions
const eventSubscriptions = new Map<number, Set<AuthenticatedWebSocket>>();

export function setupEventWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/ws/events'
  });

  // Handle HTTP upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    
    if (pathname === '/ws/events') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    console.log('📡 New Event WebSocket connection');

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

    console.log(`✅ User ${employeeId} (${role}) connected to Event WebSocket`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: `Welcome ${employeeId}! You are connected to real-time event system.`,
      userId,
      employeeId,
      role
    }));

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
        case 'subscribe-event':
          await handleEventSubscription(ws, message as EventNotificationMessage);
          break;
            
        case 'unsubscribe-event':
          await handleEventUnsubscription(ws, message);
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
        console.error('❌ Error processing event message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          code: 'PROCESSING_ERROR'
        } as ErrorResponse));
      }
    });

    ws.on('close', () => {
      console.log(`🔌 User ${employeeId} disconnected from Event WebSocket`);
      // Remove subscriptions when disconnected
      for (const [eventId, subscribers] of eventSubscriptions.entries()) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          eventSubscriptions.delete(eventId);
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Event WebSocket error for ${employeeId}:`, error);
    });
  });

  return wss;
}

async function handleEventSubscription(ws: AuthenticatedWebSocket, message: EventNotificationMessage) {
  try {
    if (!ws.userId) {
      throw new Error('User not authenticated');
    }

    const { eventId } = message;

    // Verify event exists
    const event = await EventUserActions.getEventById(eventId);
    if (!event) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Event not found',
        code: 'EVENT_NOT_FOUND'
      } as ErrorResponse));
      return;
    }

    // Add to subscription
    if (!eventSubscriptions.has(eventId)) {
      eventSubscriptions.set(eventId, new Set());
    }
    eventSubscriptions.get(eventId)?.add(ws);

    ws.send(JSON.stringify({
      type: 'success',
      message: `Subscribed to event: ${event.eventName}`,
      data: { eventId, eventName: event.eventName }
    } as SuccessResponse));

    console.log(`✅ User ${ws.employeeId} subscribed to event ${eventId}`);

  } catch (error: unknown) {
    console.error('❌ Event subscription error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to subscribe to event',
      code: 'SUBSCRIPTION_FAILED'
    } as ErrorResponse));
  }
}

async function handleEventUnsubscription(ws: AuthenticatedWebSocket, message: { eventId: number }) {
  try {
    const { eventId } = message;

    if (!eventSubscriptions.has(eventId)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not subscribed to this event',
        code: 'NOT_SUBSCRIBED'
      } as ErrorResponse));
      return;
    }

    eventSubscriptions.get(eventId)?.delete(ws);
    if (eventSubscriptions.get(eventId)?.size === 0) {
      eventSubscriptions.delete(eventId);
    }

    ws.send(JSON.stringify({
      type: 'success',
      message: `Unsubscribed from event ${eventId}`,
    } as SuccessResponse));

    console.log(`✅ User ${ws.employeeId} unsubscribed from event ${eventId}`);

  } catch (error: unknown) {
    console.error('❌ Event unsubscription error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to unsubscribe from event',
      code: 'UNSUBSCRIPTION_FAILED'
    } as ErrorResponse));
  }
}

/**
 * Broadcast event updates to all subscribers
 * Usage: broadcastEventUpdate(eventId, 'created', eventData)
 */
export function broadcastEventUpdate(eventId: number, action: EventAction, data: unknown) {
  const subscribers = eventSubscriptions.get(eventId);
  
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const message: EventUpdateMessage = {
    type: 'event-update',
    eventId,
    action,
    data
  };

  subscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });

  console.log(`📢 Broadcasted event update for event ${eventId} to ${subscribers.size} subscribers`);
}

/**
 * Broadcast to all admins connected to event WebSocket
 */
export function broadcastToEventAdmins(message: unknown) {
  let adminCount = 0;

  for (const subscribers of eventSubscriptions.values()) {
    subscribers.forEach((ws) => {
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
