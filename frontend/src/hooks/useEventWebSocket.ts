/**
 * useEventWebSocket.ts
 * ─────────────────────────────────────────
 * Custom hook สำหรับ WebSocket connection กับ /ws/events
 *
 * วิธีใช้:
 *   const { isConnected, lastMessage, subscribe, unsubscribe } = useEventWebSocket();
 *
 * WebSocket URL: ws://HOST/ws/events?userId=1&employeeId=EMP001&role=ADMIN
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type WSMessageType =
  | 'connected'
  | 'success'
  | 'event-update'
  | 'pong'
  | 'error';

export type WSEventAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'participant-joined'
  | 'participant-left';

export interface WSMessage {
  type: WSMessageType;
  message?: string;
  eventId?: number;
  action?: WSEventAction;
  data?: Record<string, unknown>;
  timestamp?: string;
  code?: string;
}

interface UseEventWebSocketReturn {
  isConnected: boolean;
  lastMessage: WSMessage | null;
  subscribe: (eventId: number) => void;
  unsubscribe: (eventId: number) => void;
  ping: () => void;
}

export function useEventWebSocket(): UseEventWebSocketReturn {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const connect = useCallback(() => {
    if (!user) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
        .replace(/^http/, 'ws')
        .replace('/api', '');

    const url = `${wsBase}/ws/events?userId=${user.id}&employeeId=${encodeURIComponent(
      user.employeeId
    )}&role=${user.role.toUpperCase()}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        setLastMessage(msg);
      } catch {
        console.error('[WS] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 5 seconds using ref to avoid circular dependency
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current?.(), 5000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [user]);

  // Keep ref in sync with the latest connect callback
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const subscribe = useCallback(
    (eventId: number) => send({ type: 'subscribe-event', eventId }),
    [send]
  );

  const unsubscribe = useCallback(
    (eventId: number) => send({ type: 'unsubscribe-event', eventId }),
    [send]
  );

  const ping = useCallback(() => send({ type: 'ping' }), [send]);

  return { isConnected, lastMessage, subscribe, unsubscribe, ping };
}
