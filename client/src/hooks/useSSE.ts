'use client';

import { useEffect, useRef, useState } from 'react';
import { getConfig } from '@/lib/config';
import { SSEEvent } from '@/lib/types';

interface UseSSEOptions {
  onInboxUpdate?: () => void;
}

export function useSSE(userId: string, options: UseSSEOptions = {}) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onInboxUpdateRef = useRef(options.onInboxUpdate);
  onInboxUpdateRef.current = options.onInboxUpdate;

  const connect = () => {
    if (eventSourceRef.current) return;

    const { apiUrl, apiKey } = getConfig();
    const jwtToken = typeof window !== 'undefined' ? localStorage.getItem('buzz_jwt_token') : null;
    const token = jwtToken || apiKey;
    const url = `${apiUrl}/api/v1/stream?token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(userId)}`;

    setStatus('connecting');
    setError(null);

    try {
      const eventSource = new EventSource(url);

      eventSource.addEventListener('connected', (ev) => {
        const data = JSON.parse(ev.data);
        setEvents((prev) => [
          ...prev,
          { type: 'connected', timestamp: new Date().toISOString(), data },
        ]);
        setStatus('connected');
      });

      eventSource.addEventListener('notification', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setEvents((prev) => [
            ...prev,
            { type: 'notification', timestamp: new Date().toISOString(), data },
          ]);
          // If the payload signals an inbox update, call the callback
          if (data?.type === 'inbox_update' && onInboxUpdateRef.current) {
            onInboxUpdateRef.current();
          }
        } catch (e) {
          console.error('Failed to parse notification event:', e);
        }
      });

      eventSource.addEventListener('error', (ev) => {
        const data = JSON.parse((ev as MessageEvent).data || '{}');
        setEvents((prev) => [
          ...prev,
          { type: 'error', timestamp: new Date().toISOString(), error: data.error || 'Unknown error' },
        ]);
        setStatus('error');
      });

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setStatus('disconnected');
        } else {
          setStatus('error');
          setError('Connection error');
          eventSource.close();
          eventSourceRef.current = null;
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('error');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('disconnected');
    setEvents([]);
  };

  const clearEvents = () => setEvents([]);

  useEffect(() => {
    connect();
    return () => { disconnect(); };
  }, [userId]);

  return { events, status, error, connect, disconnect, clearEvents };
}
