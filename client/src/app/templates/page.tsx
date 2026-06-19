'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Template, Channel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Plus, Trash2, Tag, Eye, Pencil } from 'lucide-react';

const ALL_CHANNELS: Channel[] = ['email', 'sms', 'push', 'in_app'];
const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'Email', sms: 'SMS', push: 'Push', in_app: 'In-App',
};

function extractVars(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
}

type Tab = 'list' | 'create' | 'edit';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('list');
  const [listError, setListError] = useState<string | null>(null);

  // Shared form state (used for both create and edit)
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [channels, setChannels] = useState<Channel[]>(['email']);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variablesInput, setVariablesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listTemplates({ limit: 100 });
      setTemplates(r.data || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(''); setChannels(['email']); setSubject(''); setBody(''); setVariablesInput('');
    setFormError(null); setEditingTpl(null);
  };

  const openCreate = () => { resetForm(); setTab('create'); };

  const openEdit = (tpl: Template) => {
    setEditingTpl(tpl);
    setName(tpl.name);
    setChannels(tpl.channels as Channel[]);
    setSubject(tpl.subject ?? '');
    setBody(tpl.body);
    // Show any variables that aren't auto-detected from the body/subject
    const autoDetected = new Set([...extractVars(tpl.body), ...extractVars(tpl.subject ?? '')]);
    const manual = tpl.variables.filter(v => !autoDetected.has(v));
    setVariablesInput(manual.join(', '));
    setFormError(null);
    setTab('edit');
  };

  const backToList = () => { resetForm(); setTab('list'); };

  const toggleChannel = (ch: Channel) => {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const detectedVars = [...new Set([...extractVars(body), ...extractVars(subject)])];
  const manualVars = variablesInput.split(',').map(v => v.trim()).filter(Boolean);
  const allVars = [...new Set([...detectedVars, ...manualVars])];
  const needsSubject = channels.includes('email');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (channels.length === 0) { setFormError('Select at least one channel'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.createTemplate({ name, channels, subject: subject || undefined, body, variables: allVars });
      resetForm();
      setTab('list');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTpl) return;
    if (channels.length === 0) { setFormError('Select at least one channel'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.updateTemplate(editingTpl.name, {
        channels,
        subject: subject || undefined,
        body,
        variables: allVars,
      });
      resetForm();
      setTab('list');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (tplName: string) => {
    if (!confirm(`Delete template "${tplName}"?`)) return;
    try { await api.deleteTemplate(tplName); await load(); }
    catch (e) { console.error(e); }
  };

  const isEditing = tab === 'edit';

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Templates</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Reusable notification templates with dynamic variables</p>
        </div>
        {tab === 'list' ? (
          <Button onClick={openCreate}>
            <Plus size={14} />
            New Template
          </Button>
        ) : (
          <Button variant="outline" onClick={backToList}>
            Back to list
          </Button>
        )}
      </div>

      {/* ── CREATE / EDIT FORM ───────────────────────────────────────────────── */}
      {(tab === 'create' || tab === 'edit') && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="col-span-1 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isEditing
                    ? <><Pencil size={14} className="text-[var(--accent)]" /> Edit Template</>
                    : <><Plus size={14} className="text-[var(--accent)]" /> New Template</>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={isEditing ? handleEdit : handleCreate} className="space-y-5">
                  <div>
                    <Label htmlFor="tname">Template Name</Label>
                    <Input id="tname" value={name}
                      onChange={e => !isEditing && setName(e.target.value)}
                      placeholder="welcome_email"
                      disabled={isEditing}
                      required
                      className={isEditing ? 'opacity-60 cursor-not-allowed' : ''}
                    />
                    {isEditing && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">Name cannot be changed after creation</p>
                    )}
                  </div>

                  <div>
                    <Label>Channels</Label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {ALL_CHANNELS.map(ch => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(ch)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors ${
                            channels.includes(ch)
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                          }`}
                        >
                          {CHANNEL_LABELS[ch]}
                        </button>
                      ))}
                    </div>
                    {channels.length === 0 && (
                      <p className="text-xs text-[var(--destructive)] mt-1">Select at least one channel</p>
                    )}
                  </div>

                  {needsSubject && (
                    <div>
                      <Label htmlFor="tsubj">Subject</Label>
                      <Input id="tsubj" value={subject} onChange={e => setSubject(e.target.value)}
                        placeholder="Welcome {{name}}!" required />
                      <p className="text-xs text-[var(--text-muted)] mt-1">Required for Email</p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="tbody">Body</Label>
                    <Textarea id="tbody" value={body} onChange={e => setBody(e.target.value)}
                      placeholder={`Hi {{name}},\n\nWelcome to {{company}}!`}
                      className="min-h-[120px] font-mono text-xs" required />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Use <code className="font-mono">{'{{variable}}'}</code> for dynamic values
                    </p>
                  </div>

                  {detectedVars.length > 0 && (
                    <div>
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                        Auto-detected variables
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {detectedVars.map(v => (
                          <span key={v} className="flex items-center gap-1 text-[0.68rem] font-mono px-1.5 py-0.5 rounded border border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]">
                            <Tag size={9} />{v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="tvars">Additional Variables (optional)</Label>
                    <Input id="tvars" value={variablesInput} onChange={e => setVariablesInput(e.target.value)}
                      placeholder="extra_var, another_var" />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Comma-separated. Variables in the body are detected automatically.
                    </p>
                  </div>

                  {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

                  <Button type="submit" disabled={submitting || channels.length === 0} className="w-full">
                    {isEditing ? <Pencil size={14} /> : <FileText size={14} />}
                    {submitting
                      ? (isEditing ? 'Saving…' : 'Creating…')
                      : (isEditing ? 'Save Changes' : 'Create Template')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Live preview */}
          <div className="col-span-1 lg:col-span-2">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye size={13} className="text-[var(--accent)]" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Channels</div>
                  <div className="flex flex-wrap gap-1">
                    {channels.length === 0
                      ? <span className="text-xs text-[var(--text-muted)]">None selected</span>
                      : channels.map(ch => <Badge key={ch} variant="default">{ch}</Badge>)}
                  </div>
                </div>

                {(subject || needsSubject) && (
                  <div>
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Subject</div>
                    <p className="text-sm">{subject || <span className="text-[var(--text-muted)] italic">empty</span>}</p>
                  </div>
                )}

                <div>
                  <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">Body</div>
                  <pre className="text-xs font-mono whitespace-pre-wrap bg-[var(--bg-secondary)] rounded-[var(--radius)] p-3 leading-relaxed border border-[var(--border-color)] min-h-[60px]">
                    {body || <span className="text-[var(--text-muted)] italic">empty</span>}
                  </pre>
                </div>

                {allVars.length > 0 && (
                  <div>
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                      All variables ({allVars.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allVars.map(v => (
                        <span key={v} className="flex items-center gap-1 text-[0.68rem] font-mono px-1.5 py-0.5 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          <Tag size={9} />{v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── TEMPLATE LIST ─────────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={14} className="text-[var(--accent)]" />
              Templates
              {templates.length > 0 && <Badge variant="secondary">{templates.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {listError && (
              <div className="p-5"><Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert></div>
            )}
            {loading ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
            ) : templates.length === 0 ? (
              <div className="empty-state">
                <FileText size={28} className="mb-3 opacity-30" />
                <p className="text-sm">No templates yet</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                  <Plus size={13} /> Create one
                </Button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Channels</th>
                    <th>Variables</th>
                    <th>Subject</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id}>
                      <td className="font-medium font-mono text-xs">{t.name}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {t.channels.map(ch => <Badge key={ch} variant="secondary">{ch}</Badge>)}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {t.variables.length === 0
                            ? <span className="text-xs text-[var(--text-muted)]">—</span>
                            : t.variables.map(v => (
                              <span key={v} className="flex items-center gap-0.5 text-[0.68rem] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                <Tag size={9} />{v}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="text-xs text-[var(--text-secondary)] max-w-[160px] truncate">
                        {t.subject ?? <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}
                            className="h-7 w-7 text-[var(--text-secondary)] hover:text-[var(--accent)]">
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => del(t.name)}
                            className="h-7 w-7 text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
