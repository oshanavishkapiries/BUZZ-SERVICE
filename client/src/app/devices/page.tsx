'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DeviceToken, Platform } from '@/lib/types';
import { getUserId } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Plus, Trash2, Monitor, AppleIcon } from 'lucide-react';

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  android: <span className="text-[0.6rem] font-bold">AND</span>,
  ios:     <AppleIcon size={10} />,
  web:     <Monitor size={10} />,
};

const PLATFORM_VARIANT: Record<string, 'info' | 'secondary' | 'success'> = {
  android: 'info',
  ios:     'secondary',
  web:     'success',
};

export default function DevicesPage() {
  const userId = getUserId();
  const [devices, setDevices] = useState<DeviceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [token, setToken] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    setListError(null);
    try {
      const r = await api.listDevices(userId);
      setDevices(r.devices || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setRegError(null);
    setRegSuccess(false);
    try {
      await api.registerDevice({ user_id: userId, token, platform });
      setToken('');
      setRegSuccess(true);
      await load();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRegistering(false);
    }
  };

  const unregister = async (t: string) => {
    if (!confirm('Remove this device?')) return;
    try { await api.unregisterDevice(t); await load(); }
    catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Devices</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Push notification device tokens for <span className="font-mono">{userId}</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Register form */}
        <div className="col-span-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus size={14} className="text-[var(--accent)]" />
                Register Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="tok">Device Token</Label>
                  <Input id="tok" value={token} onChange={e => setToken(e.target.value)}
                    placeholder="FCM / APNs token" className="font-mono text-xs" required />
                </div>
                <div>
                  <Label htmlFor="plat">Platform</Label>
                  <Select id="plat" value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
                    <option value="android">Android (FCM)</option>
                    <option value="ios">iOS (APNs)</option>
                    <option value="web">Web Push</option>
                  </Select>
                </div>
                {regError && <Alert variant="destructive"><AlertDescription>{regError}</AlertDescription></Alert>}
                {regSuccess && <Alert variant="success"><AlertDescription>Device registered.</AlertDescription></Alert>}
                <Button type="submit" disabled={registering} className="w-full">
                  <Smartphone size={14} />
                  {registering ? 'Registering…' : 'Register'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Device list */}
        <div className="col-span-1 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone size={14} className="text-[var(--accent)]" />
                Registered Devices
                {devices.length > 0 && <Badge variant="secondary">{devices.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {listError && (
                <div className="p-4"><Alert variant="destructive"><AlertDescription>{listError}</AlertDescription></Alert></div>
              )}
              {loading ? (
                <div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading…</div>
              ) : devices.length === 0 ? (
                <div className="empty-state">
                  <Smartphone size={28} className="mb-3 opacity-30" />
                  <p className="text-sm">No devices registered</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Token</th>
                      <th>Registered</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map(d => (
                      <tr key={d.id}>
                        <td>
                          <Badge variant={PLATFORM_VARIANT[d.platform] ?? 'secondary'} className="flex items-center gap-1 w-fit">
                            {PLATFORM_ICON[d.platform]}
                            {d.platform}
                          </Badge>
                        </td>
                        <td className="font-mono text-xs text-[var(--text-muted)]">{d.token.slice(0, 28)}…</td>
                        <td className="text-xs text-[var(--text-muted)]">{new Date(d.created_at).toLocaleDateString()}</td>
                        <td>
                          <Button variant="ghost" size="icon" onClick={() => unregister(d.token)}
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
        </div>
      </div>
    </div>
  );
}
