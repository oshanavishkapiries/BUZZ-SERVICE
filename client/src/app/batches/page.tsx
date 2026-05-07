'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Batch, Channel, Priority } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Layers, Send, RefreshCcw } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  completed:  'success',
  processing: 'info',
  queued:     'warning',
  failed:     'destructive',
  pending:    'secondary',
};

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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [datasource, setDatasource] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [priority, setPriority] = useState<Priority>('normal');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

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

  useEffect(() => { load(); }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSentId(null);
    try {
      const r = await api.sendBulk({ datasource_name: datasource, endpoint_name: endpoint, template_name: templateName, channel, priority });
      setSentId(r.batch_id);
      setDatasource(''); setEndpoint(''); setTemplateName('');
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
              <div>
                <Label htmlFor="ds">Datasource Name</Label>
                <Input id="ds" value={datasource} onChange={e => setDatasource(e.target.value)}
                  placeholder="crm" required />
              </div>
              <div>
                <Label htmlFor="ep">Endpoint Name</Label>
                <Input id="ep" value={endpoint} onChange={e => setEndpoint(e.target.value)}
                  placeholder="active_users" required />
              </div>
              <div>
                <Label htmlFor="tmpl">Template Name</Label>
                <Input id="tmpl" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  placeholder="welcome_email" required />
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
              <Button type="submit" disabled={sending} className="w-full">
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
                  <th>Status</th>
                  <th>Progress</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Failed</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id}>
                    <td>
                      <div className="font-medium text-xs">{b.datasource_name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{b.endpoint_name}</div>
                    </td>
                    <td><Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>{b.status}</Badge></td>
                    <td className="min-w-[120px]">
                      <ProgressBar value={b.sent_count} max={b.total_count} />
                    </td>
                    <td className="text-right text-xs font-mono text-green-600 dark:text-green-400">{b.sent_count}</td>
                    <td className="text-right text-xs font-mono text-red-500">{b.failed_count}</td>
                    <td className="text-right text-xs font-mono text-[var(--text-muted)]">{b.total_count}</td>
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
