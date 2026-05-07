'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Template, Channel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Plus, Trash2, Tag } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await api.createTemplate({
        name, channel,
        subject: subject || undefined,
        body,
        variables: variables.split(',').map(v => v.trim()).filter(Boolean),
      });
      setName(''); setSubject(''); setBody(''); setVariables('');
      setTab('list');
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const del = async (name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try { await api.deleteTemplate(name); await load(); }
    catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Templates</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Reusable notification templates</p>
        </div>
        <Button onClick={() => setTab(tab === 'create' ? 'list' : 'create')}>
          <Plus size={14} />
          {tab === 'create' ? 'Back to list' : 'New Template'}
        </Button>
      </div>

      {tab === 'create' && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus size={14} className="text-[var(--accent)]" />
              New Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="tname">Template Name</Label>
                <Input id="tname" value={name} onChange={e => setName(e.target.value)}
                  placeholder="welcome_email" required />
              </div>
              <div>
                <Label htmlFor="tch">Channel</Label>
                <Select id="tch" value={channel} onChange={e => setChannel(e.target.value as Channel)}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="in_app">In-App</option>
                </Select>
              </div>
              {channel === 'email' && (
                <div>
                  <Label htmlFor="tsubj">Subject</Label>
                  <Input id="tsubj" value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="Welcome {{name}}!" required />
                </div>
              )}
              <div>
                <Label htmlFor="tbody">Body</Label>
                <Textarea id="tbody" value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Hi {{name}}, welcome to…" className="min-h-[100px]" required />
              </div>
              <div>
                <Label htmlFor="tvars">Variables (comma-separated)</Label>
                <Input id="tvars" value={variables} onChange={e => setVariables(e.target.value)}
                  placeholder="name, company, url" />
                <p className="text-xs text-[var(--text-muted)] mt-1">These map to <code>{'{{variable}}'}</code> in your template</p>
              </div>
              {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}
              <Button type="submit" disabled={creating} className="w-full">
                <FileText size={14} />
                {creating ? 'Creating…' : 'Create Template'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText size={14} className="text-[var(--accent)]" />
              Templates
              {templates.length > 0 && (
                <Badge variant="secondary">{templates.length}</Badge>
              )}
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
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab('create')}>
                  <Plus size={13} /> Create one
                </Button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Channel</th>
                    <th>Variables</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id}>
                      <td className="font-medium font-mono text-xs">{t.name}</td>
                      <td>
                        <Badge variant="secondary">{t.channels.join(', ')}</Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {t.variables.length === 0
                            ? <span className="text-xs text-[var(--text-muted)]">—</span>
                            : t.variables.map(v => (
                              <span key={v} className="flex items-center gap-0.5 text-[0.68rem] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                <Tag size={9} />
                                {v}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => del(t.name)}
                          className="h-7 w-7 text-[var(--destructive)] hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 size={13} />
                        </Button>
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
