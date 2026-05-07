'use client';

import { useSSE } from '@/hooks/useSSE';
import { getUserId } from '@/lib/config';
import { useState, useRef, useEffect } from 'react';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">Live Stream</h1>
        <p className="text-[var(--text-secondary)]">Real-time Server-Sent Events feed</p>
      </div>

      {/* Controls */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
            {status === 'connecting'
              ? 'Connecting...'
              : status === 'connected'
                ? 'Connected'
                : status === 'error'
                  ? 'Error'
                  : 'Disconnected'}
          </span>
        </div>

        <div className="flex gap-2">
          {status !== 'connected' && (
            <button onClick={connect} className="btn-primary">
              Connect
            </button>
          )}
          {status === 'connected' && (
            <button onClick={disconnect} className="btn-secondary">
              Disconnect
            </button>
          )}
          <button onClick={clearEvents} className="btn-secondary">
            Clear
          </button>
          <label className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}

      {/* Events Stream */}
      <div ref={scrollRef} className="card p-0 max-h-96 overflow-y-auto border-0" style={{ borderWidth: '1px' }}>
        {events.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-secondary)]">
            {status === 'connected' ? 'Waiting for events...' : 'Connect to see events'}
          </div>
        ) : (
          <div className="space-y-0">
            {events.map((event, i) => (
              <div key={i} className="border-b border-[var(--border-color)] last:border-0 p-4 hover:bg-[var(--bg-secondary)] transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded font-medium text-white ${
                        event.type === 'connected'
                          ? 'bg-green-500'
                          : event.type === 'notification'
                            ? 'bg-blue-500'
                            : event.type === 'error'
                              ? 'bg-red-500'
                              : 'bg-gray-500'
                      }`}
                    >
                      {event.type}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {event.data && (
                  <div className="bg-[var(--bg-secondary)] p-3 rounded text-xs font-mono text-[var(--text-secondary)] overflow-x-auto">
                    <pre>{JSON.stringify(event.data, null, 2).slice(0, 500)}</pre>
                  </div>
                )}

                {event.error && <div className="text-red-600 dark:text-red-400 text-sm">{event.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-4 rounded border border-[var(--border-color)]">
        <strong>Info:</strong> Connected to user {userId}. Events are displayed as they arrive from the server.
      </div>
    </div>
  );
}
