'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Channel, Priority, Notification, Template, ProviderConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, List, ChevronLeft, ChevronRight, FileText, Type, Tag, Eye } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'secondary'> = {
  delivered: 'success', sent: 'info', queued: 'warning', processing: 'warning', failed: 'destructive',
};
const CHANNEL_VARIANT: Record<string, 'default' | 'info' | 'secondary' | 'warning'> = {
  email: 'default', sms: 'info', push: 'warning', in_app: 'secondary',
};

// Renders {{variable}} placeholders in preview text
function renderPreview(text: string, data: Record<string, string>): string {
  return Object.entries(data).reduce(
    (s, [k, v]) => s.replaceAll(`{{${k}}}`, v || `{{${k}}}`),
    text
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'send' | 'list'>('send');

  // ── Send mode: direct vs template ──────────────────────────────────────────
  const [sendMode, setSendMode] = useState<'direct' | 'template'>('direct');

  // Direct send
  const [to, setTo] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [priority, setPriority] = useState<Priority>('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [availableProviders, setAvailableProviders] = useState<ProviderConfig[]>([]);

  // Template send
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplChannel, setTplChannel] = useState<Channel>('email');
  const [tplTo, setTplTo] = useState('');
  const [tplPriority, setTplPriority] = useState<Priority>('normal');
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [tplVarValues, setTplVarValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [loadingTpls, setLoadingTpls] = useState(false);
  const [tplLoadError, setTplLoadError] = useState<string | null>(null);

  // Shared send state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<Notification | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // List
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [offset, setOffset] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const limit = 20;

  // ── Load providers for the active channel ─────────────────────────────────
  useEffect(() => {
    api.listProviders()
      .then(r => setAvailableProviders(r.data || []))
      .catch(() => setAvailableProviders([]));
  }, []);

  const channelProviders = availableProviders.filter(p => p.is_active && p.channel === channel);

  // ── Fetch templates for the selected channel ────────────────────────────────
  useEffect(() => {
    if (sendMode !== 'template') return;
    setSelectedTpl(null);
    setTplVarValues({});
    setTemplates([]);
    setTplLoadError(null);
    setLoadingTpls(true);
    api.listTemplates({ channel: tplChannel, limit: 100 })
      .then(r => setTemplates(r.data || []))
      .catch(e => setTplLoadError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoadingTpls(false));
  }, [sendMode, tplChannel]);

  const handleSelectTemplate = (name: string) => {
    const tpl = templates.find(t => t.name === name) ?? null;
    setSelectedTpl(tpl);
    setTplVarValues(
      Object.fromEntries((tpl?.variables ?? []).map(v => [v, '']))
    );
    setShowPreview(false);
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendResult(null);

    try {
      let r: Notification;
      if (sendMode === 'template' && selectedTpl) {
        r = await api.sendNotification({
          to: tplTo,
          channel: tplChannel,
          priority: tplPriority,
          template: selectedTpl.name,
          data: tplVarValues,
        });
      } else {
        r = await api.sendNotification({
          to, channel, priority,
          provider: selectedProvider || undefined,
          subject: subject || undefined,
          body,
        });
      }
      setSendResult(r);
      // Reset direct fields; keep template selection for repeat sends
      if (sendMode === 'direct') { setTo(''); setSubject(''); setBody(''); }
      else { setTplTo(''); }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  // ── Load notifications list ────────────────────────────────────────────────
  const loadNotifications = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listNotifications({
        status: filterStatus || undefined,
        channel: filterChannel || undefined,
        limit, offset,
      });
      setNotifications(r.data || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, [filterStatus, filterChannel, offset]);

  // ── Computed preview ───────────────────────────────────────────────────────
  const previewBody    = selectedTpl ? renderPreview(selectedTpl.body, tplVarValues) : '';
  const previewSubject = selectedTpl?.subject ? renderPreview(selectedTpl.subject, tplVarValues) : '';

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

      {/* ── SEND TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'send' && (
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>New Notification</CardTitle>
                  {/* Mode switcher */}
                  <div className="flex gap-1 p-0.5 rounded-[var(--radius)] bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={() => { setSendMode('direct'); setSendError(null); setSendResult(null); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium transition-colors ${
                        sendMode === 'direct'
                          ? 'bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Type size={11} /> Direct
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSendMode('template'); setSendError(null); setSendResult(null); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium transition-colors ${
                        sendMode === 'template'
                          ? 'bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <FileText size={11} /> Template
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSend} className="space-y-4">

                  {/* ── DIRECT MODE ─────────────────────────────────────────── */}
                  {sendMode === 'direct' && (
                    <>
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
                          <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)}
                            placeholder="Email subject" />
                        </div>
                      )}
                      {channelProviders.length > 0 && (
                        <div>
                          <Label htmlFor="prov">Provider <span className="font-normal text-[var(--text-muted)]">(optional)</span></Label>
                          <Select id="prov" value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                            <option value="">Default</option>
                            {channelProviders.map(p => (
                              <option key={p.id} value={p.name}>
                                {p.name}{p.is_default ? ' (default)' : ''}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="body">Body</Label>
                        <Textarea id="body" value={body} onChange={e => setBody(e.target.value)}
                          placeholder="Notification content…" className="min-h-[100px]" required />
                      </div>
                    </>
                  )}

                  {/* ── TEMPLATE MODE ───────────────────────────────────────── */}
                  {sendMode === 'template' && (
                    <>
                      <div>
                        <Label htmlFor="tplTo">Recipient</Label>
                        <Input id="tplTo" value={tplTo} onChange={e => setTplTo(e.target.value)}
                          placeholder="email / phone / user ID" required />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="tplCh">Channel</Label>
                          <Select id="tplCh" value={tplChannel} onChange={e => setTplChannel(e.target.value as Channel)}>
                            <option value="email">Email</option>
                            <option value="sms">SMS</option>
                            <option value="push">Push</option>
                            <option value="in_app">In-App</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="tplPri">Priority</Label>
                          <Select id="tplPri" value={tplPriority} onChange={e => setTplPriority(e.target.value as Priority)}>
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="tplName">Template</Label>
                        {loadingTpls ? (
                          <div className="h-9 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                        ) : tplLoadError ? (
                          <div className="h-9 flex items-center px-3 rounded-[var(--radius)] border border-red-300 text-sm text-red-500">
                            {tplLoadError}
                          </div>
                        ) : templates.length === 0 ? (
                          <div className="h-9 flex items-center px-3 rounded-[var(--radius)] border border-[var(--border-color)] text-sm text-[var(--text-muted)]">
                            No templates for {tplChannel} — create one in Templates
                          </div>
                        ) : (
                          <Select id="tplName" value={selectedTpl?.name ?? ''}
                            onChange={e => handleSelectTemplate(e.target.value)} required>
                            <option value="">Select a template…</option>
                            {templates.map(t => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </Select>
                        )}
                      </div>

                      {/* Variable inputs */}
                      {selectedTpl && selectedTpl.variables.length > 0 && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            <Tag size={11} />
                            Template Variables
                          </div>
                          {selectedTpl.variables.map(v => (
                            <div key={v}>
                              <Label htmlFor={`var_${v}`}>
                                {v}
                                <span className="ml-1 font-normal normal-case text-[var(--text-muted)]">
                                  — used as <code className="font-mono">{`{{${v}}}`}</code>
                                </span>
                              </Label>
                              <Input
                                id={`var_${v}`}
                                value={tplVarValues[v] ?? ''}
                                onChange={e => setTplVarValues(p => ({ ...p, [v]: e.target.value }))}
                                placeholder={`Value for {{${v}}}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedTpl && selectedTpl.variables.length === 0 && (
                        <p className="text-xs text-[var(--text-muted)] italic">
                          This template has no variables — it will be sent as-is.
                        </p>
                      )}
                    </>
                  )}

                  <Button type="submit" disabled={sending || (sendMode === 'template' && !selectedTpl)} className="w-full">
                    <Send size={14} />
                    {sending ? 'Sending…' : 'Send Notification'}
                  </Button>

                  {sendError  && <Alert variant="destructive"><AlertDescription>{sendError}</AlertDescription></Alert>}
                  {sendResult && (
                    <Alert variant="success">
                      <AlertDescription>
                        Sent — ID: <span className="font-mono text-xs">{sendResult.id}</span>
                        {' '}&middot; <Badge variant={STATUS_VARIANT[sendResult.status] ?? 'secondary'}>{sendResult.status}</Badge>
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── PREVIEW PANEL ──────────────────────────────────────────────── */}
          <div className="col-span-2">
            {sendMode === 'template' && selectedTpl ? (
              <Card className="sticky top-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Eye size={13} className="text-[var(--accent)]" />
                      Preview
                    </CardTitle>
                    <button
                      type="button"
                      onClick={() => setShowPreview(v => !v)}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      {showPreview ? 'Show raw' : 'Show rendered'}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Template</div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-medium">{selectedTpl.name}</span>
                      <Badge variant="secondary">{selectedTpl.channels.join(', ')}</Badge>
                    </div>
                  </div>

                  {(selectedTpl.subject || previewSubject) && (
                    <div>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Subject</div>
                      <p className="text-sm">
                        {showPreview ? previewSubject : selectedTpl.subject}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Body</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap bg-[var(--bg-secondary)] rounded-[var(--radius)] p-3 leading-relaxed border border-[var(--border-color)]">
                      {showPreview ? previewBody : selectedTpl.body}
                    </pre>
                  </div>

                  {selectedTpl.variables.length > 0 && (
                    <div>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">Variables</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedTpl.variables.map(v => (
                          <span key={v}
                            className={`flex items-center gap-1 text-[0.68rem] font-mono px-1.5 py-0.5 rounded border ${
                              tplVarValues[v]
                                ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                            }`}
                          >
                            <Tag size={9} />
                            {v}{tplVarValues[v] ? ` = "${tplVarValues[v]}"` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : sendMode === 'template' ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <FileText size={28} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm text-[var(--text-muted)]">Select a template to see a preview</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <FileText size={28} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm text-[var(--text-muted)]">Switch to Template mode to use pre-defined content</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── LIST TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <div className="space-y-4">
          {listError && <Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert>}

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
                        <th>Template</th>
                        <th>Recipient</th>
                        <th>Body</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-[var(--text-muted)]">No notifications found</td>
                        </tr>
                      ) : notifications.map(n => (
                        <tr key={n.id}>
                          <td><Badge variant={CHANNEL_VARIANT[n.channel] ?? 'secondary'}>{n.channel}</Badge></td>
                          <td><Badge variant={STATUS_VARIANT[n.status] ?? 'secondary'}>{n.status}</Badge></td>
                          <td>
                            {n.template_id
                              ? <span className="font-mono text-xs text-[var(--accent)]"><FileText size={10} className="inline mr-1" />template</span>
                              : <span className="text-xs text-[var(--text-muted)]">—</span>}
                          </td>
                          <td className="font-mono text-xs text-[var(--text-secondary)] max-w-[140px] truncate">{JSON.stringify(n.recipient)}</td>
                          <td className="max-w-[180px] truncate text-xs">{n.body}</td>
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
