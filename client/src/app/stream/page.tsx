'use client';

import { useRef, useEffect, useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { getUserId } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Radio, Play, Square, Trash2 } from 'lucide-react';

const EVENT_VARIANTS: Record<string, 'success' | 'info' | 'destructive' | 'secondary'> = {
  connected:    'success',
  notification: 'info',
  error:        'destructive',
};

export default function StreamPage() {
  const userId = getUserId();
  const { events, status, error, connect, disconnect, clearEvents } = useSSE(userId);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const statusColor = status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-[var(--text-muted)]';

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Live Stream</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Real-time Server-Sent Events</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusColor} ${status === 'connected' ? 'animate-pulse' : ''}`} />
              <Radio size={14} className="text-[var(--accent)]" />
              Connection
            </CardTitle>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}
                  className="accent-[var(--accent)] w-3 h-3" />
                Auto-scroll
              </label>
              <Button variant="outline" size="sm" onClick={clearEvents}>
                <Trash2 size={13} /> Clear
              </Button>
              {status !== 'connected' ? (
                <Button size="sm" onClick={connect}>
                  <Play size={13} /> Connect
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={disconnect}>
                  <Square size={13} /> Disconnect
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {error && (
          <div className="px-5 pb-3">
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Event Log
            {events.length > 0 && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">({events.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={scrollRef} className="h-[460px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="empty-state h-full">
                <Radio size={28} className="mb-3 opacity-30" />
                <p className="text-sm">{status === 'connected' ? 'Waiting for events…' : 'Connect to start receiving events'}</p>
              </div>
            ) : (
              <div>
                {events.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3 border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors">
                    <div className="pt-0.5 shrink-0">
                      <Badge variant={EVENT_VARIANTS[ev.type] ?? 'secondary'}>{ev.type}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      {ev.data && (
                        <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-[var(--radius)] px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(ev.data, null, 2).slice(0, 500)}
                        </pre>
                      )}
                      {ev.error && <p className="text-xs text-[var(--destructive)]">{ev.error}</p>}
                    </div>
                    <span className="text-[0.68rem] text-[var(--text-muted)] shrink-0 font-mono pt-0.5">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--text-muted)] font-mono">
        user_id: {userId} · endpoint: /api/v1/stream
      </p>
    </div>
  );
}
