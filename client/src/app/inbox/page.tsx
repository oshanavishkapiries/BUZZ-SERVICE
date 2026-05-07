'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { InboxEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inbox as InboxIcon, CheckCheck, Trash2, Mail, MailOpen } from 'lucide-react';

export default function InboxPage() {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.getInbox({ limit: 50 });
      setEntries(r.data || []);
      setUnreadCount(r.unread_count || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inbox');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    try { await api.markAsRead(id); await load(); }
    catch (e) { console.error(e); }
  };

  const del = async (id: string) => {
    try { await api.deleteInboxEntry(id); await load(); }
    catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try { await api.markAllAsRead(); await load(); }
    catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Inbox</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {entries.length} messages
            {unreadCount > 0 && (
              <> &middot; <span className="text-[var(--accent)] font-medium">{unreadCount} unread</span></>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck size={14} />
            Mark all read
          </Button>
        )}
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InboxIcon size={14} className="text-[var(--accent)]" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <InboxIcon size={32} className="mb-3 opacity-30" />
              <p className="text-sm">Your inbox is empty</p>
            </div>
          ) : (
            <div>
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-[var(--border-color)] last:border-0 transition-colors ${
                    !entry.is_read ? 'bg-[var(--accent-subtle)]' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {entry.is_read
                      ? <MailOpen size={15} className="text-[var(--text-muted)]" />
                      : <Mail    size={15} className="text-[var(--accent)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.title}</span>
                      {!entry.is_read && <Badge variant="default">New</Badge>}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] truncate">{entry.body}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!entry.is_read && (
                      <Button variant="ghost" size="icon" onClick={() => markRead(entry.id)} title="Mark read" className="h-7 w-7">
                        <CheckCheck size={13} />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => del(entry.id)} title="Delete"
                      className="h-7 w-7 text-[var(--destructive)] hover:text-[var(--destructive-hover)] hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
