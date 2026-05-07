'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Batch, Channel, Priority } from '@/lib/types';

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'send'>('list');

  // Form state
  const [datasource, setDatasource] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [priority, setPriority] = useState<Priority>('normal');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    setListError(null);
    try {
      const result = await api.listBatches({ limit: 50 });
      setBatches(result.batches || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load batches';
      setListError(message);
      setBatches([]);
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSendResult(null);

    try {
      const result = await api.sendBulk({
        datasource_name: datasource,
        endpoint_name: endpoint,
        template_name: templateName,
        channel,
        priority,
      });
      setSendResult(result.batch_id);
      setDatasource('');
      setEndpoint('');
      setTemplateName('');
      setTab('list');
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send batch');
    } finally {
      setSending(false);
    }
  };

  const getProgressPercent = (batch: Batch) => {
    if (batch.total_count === 0) return 0;
    return Math.round((batch.sent_count / batch.total_count) * 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">Batch Notifications</h1>
        <p className="text-[var(--text-secondary)]">Send bulk notifications and track progress</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[var(--border-color)]">
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-3 font-medium transition-colors ${
            tab === 'list'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Batches
        </button>
        <button
          onClick={() => setTab('send')}
          className={`px-4 py-3 font-medium transition-colors ${
            tab === 'send'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Send Batch
        </button>
      </div>

      {tab === 'send' && (
        <div className="card p-6 max-w-2xl">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label-base">Datasource Name</label>
              <input
                type="text"
                value={datasource}
                onChange={(e) => setDatasource(e.target.value)}
                placeholder="crm"
                className="input-base w-full mt-1"
                required
              />
            </div>

            <div>
              <label className="label-base">Endpoint Name</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="active_users"
                className="input-base w-full mt-1"
                required
              />
            </div>

            <div>
              <label className="label-base">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="welcome_email"
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

            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Sending...' : 'Send Batch'}
            </button>

            {error && <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}

            {sendResult && (
              <div className="text-green-600 dark:text-green-400 text-sm border border-green-300 bg-green-50 dark:bg-green-900/20 p-3 rounded">
                Batch sent! ID: {sendResult}
              </div>
            )}
          </form>
        </div>
      )}

      {tab === 'list' && (
        <>
          {listError && (
            <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              {listError}
            </div>
          )}

          {loading ? (
            <div className="card p-6 text-center">Loading...</div>
          ) : batches.length === 0 ? (
            <div className="card p-6 text-center text-[var(--text-secondary)]">No batches found</div>
          ) : (
            <div className="space-y-4">
              {batches.map((batch) => {
                const progress = getProgressPercent(batch);
                return (
                  <div key={batch.id} className="card p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">{batch.datasource_name}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">{batch.endpoint_name}</p>
                      </div>
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                          batch.status === 'completed'
                            ? 'bg-green-500 text-white'
                            : batch.status === 'failed'
                              ? 'bg-red-500 text-white'
                              : 'bg-blue-500 text-white'
                        }`}
                      >
                        {batch.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-[var(--text-secondary)]">Total:</span>
                        <p className="font-semibold text-[var(--text-primary)]">{batch.total_count}</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-secondary)]">Sent:</span>
                        <p className="font-semibold text-green-600">{batch.sent_count}</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-secondary)]">Failed:</span>
                        <p className="font-semibold text-red-600">{batch.failed_count}</p>
                      </div>
                    </div>

                    <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
                      <div
                        className="bg-[var(--accent)] h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{progress}% complete</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
