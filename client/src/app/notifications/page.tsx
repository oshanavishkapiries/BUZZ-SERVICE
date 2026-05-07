'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Channel, Priority, Notification } from '@/lib/types';
import { useEffect } from 'react';

export default function NotificationsPage() {
  const [tab, setTab] = useState<'send' | 'list'>('send');

  // Send form state
  const [to, setTo] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [priority, setPriority] = useState<Priority>('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<Notification | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // List state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [offset, setOffset] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const limit = 10;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendResult(null);

    try {
      const result = await api.sendNotification({
        to,
        channel,
        priority,
        subject: subject || undefined,
        body,
      });
      setSendResult(result);
      setTo('');
      setSubject('');
      setBody('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    setListError(null);
    try {
      const result = await api.listNotifications({
        status: filterStatus || undefined,
        channel: filterChannel || undefined,
        limit,
        offset,
      });
      setNotifications(result.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      setListError(message);
      setNotifications([]);
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [filterStatus, filterChannel, offset]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">Notifications</h1>
        <p className="text-[var(--text-secondary)]">Send and monitor notifications</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[var(--border-color)]">
        <button
          onClick={() => setTab('send')}
          className={`px-4 py-3 font-medium transition-colors ${
            tab === 'send'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Send Notification
        </button>
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-3 font-medium transition-colors ${
            tab === 'list'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          View Notifications
        </button>
      </div>

      {/* Send Tab */}
      {tab === 'send' && (
        <div className="card p-6 max-w-2xl">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label-base">Recipient</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="user@example.com or phone number or user ID"
                className="input-base w-full mt-1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-base">Channel</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="input-base w-full mt-1">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="in_app">In-App</option>
                </select>
              </div>

              <div>
                <label className="label-base">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="input-base w-full mt-1">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {['email'].includes(channel) && (
              <div>
                <label className="label-base">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject" className="input-base w-full mt-1" />
              </div>
            )}

            <div>
              <label className="label-base">Body</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message content" className="input-base w-full mt-1 min-h-24" required />
            </div>

            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Sending...' : 'Send Notification'}
            </button>

            {sendError && <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">{sendError}</div>}

            {sendResult && (
              <div className="text-green-600 dark:text-green-400 text-sm border border-green-300 bg-green-50 dark:bg-green-900/20 p-3 rounded">
                <strong>Sent!</strong> ID: {sendResult.id} | Status: {sendResult.status}
              </div>
            )}
          </form>
        </div>
      )}

      {/* List Tab */}
      {tab === 'list' && (
        <div className="space-y-4">
          {listError && (
            <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              {listError}
            </div>
          )}

          <div className="card p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Filter by Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-base w-full mt-1">
                <option value="">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="label-base">Filter by Channel</label>
              <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="input-base w-full mt-1">
                <option value="">All Channels</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
                <option value="in_app">In-App</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="card p-6 text-center text-[var(--text-secondary)]">Loading...</div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                      <th className="text-left p-3 font-semibold">Channel</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Recipient</th>
                      <th className="text-left p-3 font-semibold">Body</th>
                      <th className="text-left p-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-[var(--text-secondary)]">
                          No notifications found
                        </td>
                      </tr>
                    ) : (
                      notifications.map((n) => (
                        <tr key={n.id} className="border-b border-[var(--border-color)]">
                          <td className="p-3">
                            <span className="inline-block px-2 py-1 bg-[var(--accent)] text-white text-xs rounded capitalize">{n.channel}</span>
                          </td>
                          <td className="p-3 capitalize">{n.status}</td>
                          <td className="p-3 text-xs font-mono text-[var(--text-secondary)]">{JSON.stringify(n.recipient).slice(0, 30)}...</td>
                          <td className="p-3 text-xs truncate max-w-xs">{n.body}</td>
                          <td className="p-3 text-xs text-[var(--text-secondary)]">{new Date(n.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {notifications.length > 0 && (
                <div className="p-4 border-t border-[var(--border-color)] flex justify-between items-center">
                  <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="btn-secondary">
                    Previous
                  </button>
                  <span className="text-sm text-[var(--text-secondary)]">Offset: {offset}</span>
                  <button onClick={() => setOffset(offset + limit)} className="btn-secondary">
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
