'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProviderConfig, CreateProviderRequest, Channel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Plus, Trash2, Star, RefreshCw } from 'lucide-react';

const CHANNELS: Channel[] = ['email', 'sms', 'push', 'in_app'];

const PROVIDER_TYPES: Record<Channel, string[]> = {
  email:  ['ses', 'smtp'],
  sms:    ['twilio', 'notifylk'],
  push:   ['fcm'],
  in_app: [],
};

const CONFIG_TEMPLATES: Record<string, string> = {
  ses: JSON.stringify({
    from_email: 'noreply@example.com',
    from_name: 'My App',
    region: 'us-east-1',
    rate_limit_rps: 14,
  }, null, 2),
  smtp: JSON.stringify({
    from_email: 'noreply@example.com',
    from_name: 'My App',
    host: 'smtp.example.com',
    port: 587,
    username: 'user@example.com',
    password: 'secret',
    use_tls: true,
    rate_limit_rps: 10,
  }, null, 2),
  twilio: JSON.stringify({
    account_sid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    auth_token: 'your_auth_token',
    from_number: '+1234567890',
    messaging_service_sid: '',
    rate_limit_per_second: 10,
  }, null, 2),
  notifylk: JSON.stringify({
    user_id: 'your_user_id',
    api_key: 'your_api_key',
    sender_id: 'NOTIFY',
    rate_limit_per_second: 10,
  }, null, 2),
  fcm: JSON.stringify({
    project_id: 'your-firebase-project',
    credentials_json: '',
    credentials_file: '/path/to/service-account.json',
  }, null, 2),
};

const CHANNEL_BADGE: Record<Channel, 'info' | 'success' | 'warning' | 'default'> = {
  email: 'info',
  sms: 'success',
  push: 'warning',
  in_app: 'default',
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [listError, setListError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [providerType, setProviderType] = useState('ses');
  const [configRaw, setConfigRaw] = useState(CONFIG_TEMPLATES['ses']);
  const [isDefault, setIsDefault] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listProviders();
      setProviders(r.data || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load providers');
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChannelChange = (ch: Channel) => {
    setChannel(ch);
    const types = PROVIDER_TYPES[ch];
    const first = types[0] || '';
    setProviderType(first);
    setConfigRaw(CONFIG_TEMPLATES[first] || '{}');
  };

  const handleProviderTypeChange = (pt: string) => {
    setProviderType(pt);
    setConfigRaw(CONFIG_TEMPLATES[pt] || '{}');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      let config: Record<string, unknown>;
      try { config = JSON.parse(configRaw); }
      catch { setCreateError('config is not valid JSON'); setCreating(false); return; }

      const req: CreateProviderRequest = {
        name,
        channel,
        provider: providerType,
        config,
        is_default: isDefault,
      };

      await api.createProvider(req);
      setName(''); setChannel('email'); setProviderType('ses');
      setConfigRaw(CONFIG_TEMPLATES['ses']); setIsDefault(false);
      setTab('list');
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create provider');
    } finally {
      setCreating(false);
    }
  };

  const del = async (id: string, pName: string) => {
    if (!confirm(`Delete provider "${pName}"? This will remove it from the registry.`)) return;
    try {
      await api.deleteProvider(id);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleDefault = async (p: ProviderConfig) => {
    try {
      await api.updateProvider(p.id, { is_default: !p.is_default });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleActive = async (p: ProviderConfig) => {
    try {
      await api.updateProvider(p.id, { is_active: !p.is_active });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const groupedByChannel = CHANNELS.reduce<Record<string, ProviderConfig[]>>((acc, ch) => {
    acc[ch] = providers.filter(p => p.channel === ch);
    return acc;
  }, {} as Record<string, ProviderConfig[]>);

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Providers</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage delivery provider configurations for email, SMS, and push
          </p>
        </div>
        <Button onClick={() => setTab(tab === 'create' ? 'list' : 'create')}>
          <Plus size={14} />
          {tab === 'create' ? 'Back to list' : 'Add Provider'}
        </Button>
      </div>

      {tab === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={14} className="text-[var(--accent)]" />
              Add Provider Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pname">Name</Label>
                  <Input
                    id="pname"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="ses-main"
                    required
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Unique name; use in <code className="font-mono">provider</code> field when sending
                  </p>
                </div>
                <div>
                  <Label>Channel</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {CHANNELS.filter(ch => PROVIDER_TYPES[ch].length > 0).map(ch => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => handleChannelChange(ch)}
                        className={`px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors ${
                          channel === ch
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>Provider Type</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {PROVIDER_TYPES[channel].map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => handleProviderTypeChange(pt)}
                      className={`px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-colors ${
                        providerType === pt
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="config">
                  Configuration <span className="text-[var(--text-muted)] font-normal">(JSON)</span>
                </Label>
                <Textarea
                  id="config"
                  value={configRaw}
                  onChange={e => setConfigRaw(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  spellCheck={false}
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Credentials stored securely in the database. Config keys depend on provider type.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-color)]"
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  Set as default provider for <strong>{channel}</strong>
                </Label>
              </div>

              {createError && (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Saving...' : 'Add Provider'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setTab('list')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'list' && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-[var(--text-secondary)] text-sm">Loading...</p>
          ) : listError ? (
            <Alert variant="destructive">
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : providers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
                <p className="text-[var(--text-secondary)] text-sm">No provider configurations yet.</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">
                  Add a provider to start delivering email, SMS, or push notifications.
                </p>
                <Button className="mt-4" onClick={() => setTab('create')}>
                  <Plus size={14} /> Add Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            CHANNELS.filter(ch => groupedByChannel[ch]?.length > 0).map(ch => (
              <div key={ch}>
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Badge variant={CHANNEL_BADGE[ch]}>{ch}</Badge>
                  <span>{groupedByChannel[ch].length} provider{groupedByChannel[ch].length !== 1 ? 's' : ''}</span>
                </h2>
                <div className="grid gap-3">
                  {groupedByChannel[ch].map(p => (
                    <Card key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                              <Badge variant="secondary">{p.provider}</Badge>
                              {p.is_default && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                  <Star size={11} fill="currentColor" /> default
                                </span>
                              )}
                              {!p.is_active && (
                                <Badge variant="destructive">inactive</Badge>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] font-mono mt-1 truncate">
                              id: {p.id}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                              Keys: {Object.keys(p.config).join(', ') || '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleDefault(p)}
                              title={p.is_default ? 'Unset default' : 'Set as default'}
                              className="text-xs"
                            >
                              <Star size={13} className={p.is_default ? 'fill-amber-400 text-amber-400' : ''} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleActive(p)}
                              title={p.is_active ? 'Deactivate' : 'Activate'}
                              className="text-xs"
                            >
                              <RefreshCw size={13} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => del(p.id, p.name)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
