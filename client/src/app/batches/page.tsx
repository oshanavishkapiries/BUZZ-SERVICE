'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Batch, Channel, Datasource, Priority, Template } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Layers, Send, RefreshCcw, XCircle, Trash2, RotateCcw } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  completed:  'success',
  processing: 'info',
  queued:     'warning',
  delivering: 'warning',
  fetching:   'info',
  failed:     'destructive',
  pending:    'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  pending:    'Pending',
  fetching:   'Fetching recipients…',
  queued:     'Queued for delivery',
  delivering: 'Delivering…',
  processing: 'Processing…',
  completed:  'Completed',
  failed:     'Failed',
  cancelled:  'Cancelled',
};

const IN_PROGRESS = new Set(['pending', 'fetching', 'queued', 'delivering', 'processing']);

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-[var(--text-muted)] w-9 text-right">{pct}%</span>
    </div>
  );
}

export default function BatchesPage() {
  const [batches, setBatches]       = useState<Batch[]>([]);
  const [loading, setLoading]       = useState(true);
  const [listError, setListError]   = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);

  // Form data
  const [datasources, setDatasources]         = useState<Datasource[]>([]);
  const [templates, setTemplates]             = useState<Template[]>([]);
  const [endpointOptions, setEndpointOptions] = useState<string[]>([]);

  const [datasource, setDatasource]     = useState('');
  const [endpoint, setEndpoint]         = useState('');
  const [templateName, setTemplateName] = useState('');
  const [channel, setChannel]           = useState<Channel>('email');
  const [priority, setPriority]         = useState<Priority>('normal');
  const [sending, setSending]           = useState(false);
  const [sendError, setSendError]       = useState<string | null>(null);
  const [sentId, setSentId]             = useState<string | null>(null);
  const [actionError, setActionError]   = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listBatches({ limit: 50 });
      setBatches(r.batches || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-poll every 4 s while any batch is in progress
  useEffect(() => {
    const anyInProgress = batches.some(b => IN_PROGRESS.has(b.status));
    if (anyInProgress && !pollRef.current) {
      pollRef.current = setInterval(load, 4000);
    } else if (!anyInProgress && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [batches]);

  useEffect(() => { load(); }, []);

  // Load datasources + templates when the form opens
  useEffect(() => {
    if (!showForm) return;
    api.listDatasources().then(r => setDatasources(r.data || [])).catch(() => {});
    api.listTemplates({ limit: 100 }).then(r => setTemplates(r.data || [])).catch(() => {});
  }, [showForm]);

  const handleDatasourceChange = (name: string) => {
    setDatasource(name);
    setEndpoint('');
    const ds = datasources.find(d => d.name === name);
    setEndpointOptions(ds?.endpoints ? Object.keys(ds.endpoints) : []);
  };

  const handleRetry = async (id: string) => {
    setActionError(null);
    try {
      await api.retryBatch(id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to retry');
    }
  };

  const handleCancel = async (id: string) => {
    setActionError(null);
    try {
      await api.cancelBatch(id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to cancel');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this batch permanently?')) return;
    setActionError(null);
    try {
      await api.deleteBatch(id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSentId(null);
    try {
      const r = await api.sendBulk({ datasource_name: datasource, endpoint_name: endpoint, template_name: templateName, channel, priority });
      setSentId(r.batch_id);
      setDatasource(''); setEndpoint(''); setTemplateName('');
      setEndpointOptions([]);
      setShowForm(false);
      await load();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Batches</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Bulk notification jobs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button onClick={() => setShowForm(v => !v)}>
            <Send size={14} />
            {showForm ? 'Cancel' : 'Send Batch'}
          </Button>
        </div>
      </div>

      {sentId && (
        <Alert variant="success">
          <AlertDescription>Batch submitted — ID: <span className="font-mono">{sentId}</span></AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send size={14} className="text-[var(--accent)]" />
              New Batch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">

              {/* Datasource — dropdown from registered datasources */}
              <div>
                <Label htmlFor="ds">Datasource</Label>
                <Select
                  id="ds"
                  value={datasource}
                  onChange={e => handleDatasourceChange(e.target.value)}
                  required
                >
                  <option value="">— select datasource —</option>
                  {datasources.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </Select>
              </div>

              {/* Endpoint — dropdown populated from selected datasource's endpoints */}
              <div>
                <Label htmlFor="ep">Endpoint</Label>
                <Select
                  id="ep"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  required
                  disabled={endpointOptions.length === 0}
                >
                  <option value="">— select endpoint —</option>
                  {endpointOptions.map(ep => (
                    <option key={ep} value={ep}>{ep}</option>
                  ))}
                </Select>
                {datasource && endpointOptions.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    This datasource has no configured endpoints.
                  </p>
                )}
              </div>

              {/* Template — dropdown from registered templates */}
              <div>
                <Label htmlFor="tmpl">Template</Label>
                <Select
                  id="tmpl"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  required
                >
                  <option value="">— select template —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.name} ({t.channels?.join(', ')})</option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bch">Channel</Label>
                  <Select id="bch" value={channel} onChange={e => setChannel(e.target.value as Channel)}>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push</option>
                    <option value="in_app">In-App</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bpri">Priority</Label>
                  <Select id="bpri" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
              </div>

              {sendError && <Alert variant="destructive"><AlertDescription>{sendError}</AlertDescription></Alert>}
              <Button type="submit" disabled={sending || !datasource || !endpoint || !templateName} className="w-full">
                <Layers size={14} />
                {sending ? 'Submitting…' : 'Submit Batch'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers size={14} className="text-[var(--accent)]" />
            Batch Jobs
            {batches.length > 0 && <Badge variant="secondary">{batches.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listError && (
            <div className="p-4"><Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert></div>
          )}
          {loading ? (
            <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
          ) : batches.length === 0 ? (
            <div className="empty-state">
              <Layers size={28} className="mb-3 opacity-30" />
              <p className="text-sm">No batch jobs yet</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Datasource / Endpoint</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Failed</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id}>
                    <td>
                      <div className="font-medium text-xs">{b.datasource_name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{b.endpoint_name}</div>
                    </td>
                    <td>
                      <span className="text-xs font-mono">{b.template_name}</span>
                    </td>
                    <td>
                      <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                      {b.error_message && (
                        <div className="text-xs text-red-500 mt-1 max-w-[180px] truncate" title={b.error_message}>
                          {b.error_message}
                        </div>
                      )}
                    </td>
                    <td className="min-w-[140px]">
                      <ProgressBar value={b.sent_count} max={b.total_count} />
                      {b.total_count > 0 && (
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {b.total_count} recipients extracted
                        </div>
                      )}
                    </td>
                    <td className="text-right text-xs font-mono text-green-600 dark:text-green-400">{b.sent_count}</td>
                    <td className="text-right text-xs font-mono text-red-500">{b.failed_count}</td>
                    <td className="text-right text-xs font-mono text-[var(--text-muted)]">{b.total_count}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(b.status === 'pending' || b.status === 'failed') && (
                          <Button variant="ghost" size="sm" onClick={() => handleRetry(b.id)} title="Retry batch">
                            <RotateCcw size={13} className="text-blue-500" />
                          </Button>
                        )}
                        {IN_PROGRESS.has(b.status) && (
                          <Button variant="ghost" size="sm" onClick={() => handleCancel(b.id)} title="Cancel batch">
                            <XCircle size={13} className="text-yellow-500" />
                          </Button>
                        )}
                        {['cancelled', 'failed', 'completed'].includes(b.status) && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)} title="Delete batch">
                            <Trash2 size={13} className="text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
