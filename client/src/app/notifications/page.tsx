'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Channel, Priority, Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, List, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  delivered: 'success',
  sent:       'info',
  queued:     'warning',
  processing: 'warning',
  failed:     'destructive',
};

const CHANNEL_VARIANT: Record<string, 'default' | 'info' | 'secondary' | 'warning'> = {
  email:  'default',
  sms:    'info',
  push:   'warning',
  in_app: 'secondary',
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<'send' | 'list'>('send');

  const [to, setTo] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [priority, setPriority] = useState<Priority>('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<Notification | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [offset, setOffset] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const limit = 20;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const r = await api.sendNotification({ to, channel, priority, subject: subject || undefined, body });
      setSendResult(r);
      setTo(''); setSubject(''); setBody('');
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSending(false);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listNotifications({ status: filterStatus || undefined, channel: filterChannel || undefined, limit, offset });
      setNotifications(r.data || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, [filterStatus, filterChannel, offset]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notifications</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Send and inspect notifications</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[var(--radius)] bg-[var(--bg-secondary)] w-fit border border-[var(--border-color)]">
        {[
          { id: 'send', label: 'Send',   icon: Send },
          { id: 'list', label: 'Browse', icon: List },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as 'send' | 'list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>New Notification</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <Label htmlFor="to">Recipient</Label>
                <Input id="to" value={to} onChange={e => setTo(e.target.value)}
                  placeholder="email / phone / user ID" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ch">Channel</Label>
                  <Select id="ch" value={channel} onChange={e => setChannel(e.target.value as Channel)}>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push</option>
                    <option value="in_app">In-App</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pri">Priority</Label>
                  <Select id="pri" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
              </div>

              {channel === 'email' && (
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
                </div>
              )}

              <div>
                <Label htmlFor="body">Body</Label>
                <Textarea id="body" value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Notification content…" className="min-h-[100px]" required />
              </div>

              <Button type="submit" disabled={sending} className="w-full">
                <Send size={14} />
                {sending ? 'Sending…' : 'Send Notification'}
              </Button>

              {sendError && <Alert variant="destructive"><AlertDescription>{sendError}</AlertDescription></Alert>}
              {sendResult && (
                <Alert variant="success">
                  <AlertDescription>
                    Sent — ID: <span className="font-mono">{sendResult.id}</span> &middot; Status: <Badge variant={STATUS_VARIANT[sendResult.status] ?? 'secondary'}>{sendResult.status}</Badge>
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'list' && (
        <div className="space-y-4">
          {listError && <Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert>}

          {/* Filters */}
          <Card>
            <CardContent className="flex gap-4 py-3">
              <div className="flex-1">
                <Label htmlFor="sf">Status</Label>
                <Select id="sf" value={filterStatus} onChange={e => { setOffset(0); setFilterStatus(e.target.value); }}>
                  <option value="">All Statuses</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </Select>
              </div>
              <div className="flex-1">
                <Label htmlFor="cf">Channel</Label>
                <Select id="cf" value={filterChannel} onChange={e => { setOffset(0); setFilterChannel(e.target.value); }}>
                  <option value="">All Channels</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="in_app">In-App</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            {loading ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Recipient</th>
                        <th>Body</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-[var(--text-muted)]">No notifications found</td>
                        </tr>
                      ) : notifications.map(n => (
                        <tr key={n.id}>
                          <td><Badge variant={CHANNEL_VARIANT[n.channel] ?? 'secondary'}>{n.channel}</Badge></td>
                          <td><Badge variant={STATUS_VARIANT[n.status] ?? 'secondary'}>{n.status}</Badge></td>
                          <td className="font-mono text-xs text-[var(--text-secondary)] max-w-[160px] truncate">{JSON.stringify(n.recipient)}</td>
                          <td className="max-w-[200px] truncate text-xs">{n.body}</td>
                          <td className="text-xs text-[var(--text-muted)] whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {notifications.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-color)]">
                    <Button variant="outline" size="sm" disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - limit))}>
                      <ChevronLeft size={14} /> Previous
                    </Button>
                    <span className="text-xs text-[var(--text-muted)]">Showing {offset + 1}–{offset + notifications.length}</span>
                    <Button variant="outline" size="sm" disabled={notifications.length < limit}
                      onClick={() => setOffset(offset + limit)}>
                      Next <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
