'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Datasource, CreateDatasourceRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Database, Plus, Trash2, Globe, Key } from 'lucide-react';

const AUTH_TYPES = ['', 'bearer', 'basic', 'api_key'];
const AUTH_LABELS: Record<string, string> = {
  '': 'None', bearer: 'Bearer Token', basic: 'Basic Auth', api_key: 'API Key Header',
};

const DEFAULT_ENDPOINT = JSON.stringify({
  active_users: {
    path: '/internal/users/active',
    method: 'GET',
    pagination_style: 'offset',
    response_format: {
      recipients_key: 'users',
      email_field: 'email',
      name_field: 'name',
      phone_field: 'phone',
    },
  },
}, null, 2);

export default function DatasourcesPage() {
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [listError, setListError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [authType, setAuthType] = useState('');
  const [authConfigRaw, setAuthConfigRaw] = useState('{}');
  const [endpointsRaw, setEndpointsRaw] = useState(DEFAULT_ENDPOINT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listDatasources();
      setDatasources(r.data || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed');
      setDatasources([]);
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
      let authConfig: Record<string, unknown> | undefined;
      let endpoints: Record<string, unknown> | undefined;

      try { authConfig = authConfigRaw.trim() ? JSON.parse(authConfigRaw) : undefined; }
      catch { setCreateError('auth_config is not valid JSON'); setCreating(false); return; }

      try { endpoints = endpointsRaw.trim() ? JSON.parse(endpointsRaw) : undefined; }
      catch { setCreateError('endpoints is not valid JSON'); setCreating(false); return; }

      const req: CreateDatasourceRequest = { name, base_url: baseURL };
      if (authType) req.auth_type = authType;
      if (authConfig && Object.keys(authConfig).length > 0) req.auth_config = authConfig;
      if (endpoints) req.endpoints = endpoints;

      await api.createDatasource(req);
      setName(''); setBaseURL(''); setAuthType(''); setAuthConfigRaw('{}'); setEndpointsRaw(DEFAULT_ENDPOINT);
      setTab('list');
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const del = async (id: string, dsName: string) => {
    if (!confirm(`Deactivate datasource "${dsName}"?`)) return;
    try { await api.deleteDatasource(id); await load(); }
    catch (e) { console.error(e); }
  };

  const authPlaceholder: Record<string, string> = {
    bearer:  '{\n  "token": "your-bearer-token"\n}',
    basic:   '{\n  "username": "...",\n  "password": "..."\n}',
    api_key: '{\n  "header": "X-API-Key",\n  "key": "..."\n}',
    '':      '{}',
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Datasources</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">External API endpoints for batch recipient fetching</p>
        </div>
        <Button onClick={() => setTab(tab === 'create' ? 'list' : 'create')}>
          <Plus size={14} />
          {tab === 'create' ? 'Back to list' : 'Register Datasource'}
        </Button>
      </div>

      {tab === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus size={14} className="text-[var(--accent)]" />
              Register Datasource
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dsname">Name</Label>
                  <Input id="dsname" value={name} onChange={e => setName(e.target.value)}
                    placeholder="master_backend" required />
                  <p className="text-xs text-[var(--text-muted)] mt-1">Unique slug used in batch send requests</p>
                </div>
                <div>
                  <Label htmlFor="dsurl">Base URL</Label>
                  <Input id="dsurl" value={baseURL} onChange={e => setBaseURL(e.target.value)}
                    placeholder="https://api.yourapp.com" required />
                </div>
              </div>

              <div>
                <Label>Auth Type</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {AUTH_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => { setAuthType(t); setAuthConfigRaw(authPlaceholder[t] ?? '{}'); }}
                      className={`px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors ${
                        authType === t
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {AUTH_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {authType && (
                <div>
                  <Label htmlFor="dsauth">Auth Config (JSON)</Label>
                  <Textarea id="dsauth" value={authConfigRaw} onChange={e => setAuthConfigRaw(e.target.value)}
                    className="min-h-[80px] font-mono text-xs" />
                </div>
              )}

              <div>
                <Label htmlFor="dsep">Endpoints (JSON)</Label>
                <Textarea id="dsep" value={endpointsRaw} onChange={e => setEndpointsRaw(e.target.value)}
                  className="min-h-[200px] font-mono text-xs" />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Each key is an endpoint name referenced in batch send requests.
                  Set <code className="font-mono">pagination_style</code> to <code className="font-mono">"offset"</code> (default) or <code className="font-mono">"page"</code>.
                </p>
              </div>

              {createError && <Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>}

              <Button type="submit" disabled={creating}>
                <Database size={14} />
                {creating ? 'Registering…' : 'Register Datasource'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={14} className="text-[var(--accent)]" />
              Registered Datasources
              {datasources.length > 0 && <Badge variant="secondary">{datasources.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {listError && (
              <div className="p-5"><Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert></div>
            )}
            {loading ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
            ) : datasources.length === 0 ? (
              <div className="empty-state">
                <Database size={28} className="mb-3 opacity-30" />
                <p className="text-sm">No datasources registered</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab('create')}>
                  <Plus size={13} /> Register one
                </Button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Base URL</th>
                    <th>Auth</th>
                    <th>Endpoints</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {datasources.map(ds => (
                    <tr key={ds.id}>
                      <td className="font-medium font-mono text-xs">{ds.name}</td>
                      <td>
                        <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <Globe size={11} className="shrink-0" />
                          <span className="truncate max-w-[180px]">{ds.base_url}</span>
                        </span>
                      </td>
                      <td>
                        {ds.auth_type ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Key size={11} className="text-[var(--accent)]" />
                            {AUTH_LABELS[ds.auth_type] ?? ds.auth_type}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">None</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {ds.endpoints
                            ? Object.keys(ds.endpoints).map(ep => (
                              <Badge key={ep} variant="secondary">{ep}</Badge>
                            ))
                            : <span className="text-xs text-[var(--text-muted)]">—</span>
                          }
                        </div>
                      </td>
                      <td>
                        <Button variant="ghost" size="icon" onClick={() => del(ds.id, ds.name)}
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
