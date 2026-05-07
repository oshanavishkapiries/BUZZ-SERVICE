'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InboxEntry } from '@/lib/types';

export default function InboxPage() {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getInbox({ limit: 50 });
      setEntries(result.data || []);
      setUnreadCount(result.unread_count || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load inbox';
      setError(message);
      setEntries([]);
      console.error('Failed to load inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markAsRead(id);
      await loadInbox();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteInboxEntry(id);
      await loadInbox();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllAsRead();
      await loadInbox();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">Inbox</h1>
          <p className="text-[var(--text-secondary)]">
            {entries.length} messages, {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-primary">
            Mark All as Read
          </button>
        )}
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-6 text-center">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="card p-6 text-center text-[var(--text-secondary)]">No messages</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-[var(--border-color)]">
            {entries.map((entry) => (
              <div key={entry.id} className={`p-4 ${entry.is_read ? '' : 'bg-[var(--accent)] bg-opacity-5'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{entry.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{entry.body}</p>
                  </div>
                  <div className="flex gap-2">
                    {!entry.is_read && (
                      <button onClick={() => handleMarkRead(entry.id)} className="btn-secondary text-xs px-2 py-1">
                        Read
                      </button>
                    )}
                    <button onClick={() => handleDelete(entry.id)} className="btn-secondary text-xs px-2 py-1 text-red-600">
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
