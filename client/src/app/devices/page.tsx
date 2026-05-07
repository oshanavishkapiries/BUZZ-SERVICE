'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DeviceToken, Platform } from '@/lib/types';
import { getUserId } from '@/lib/config';

export default function DevicesPage() {
  const userId = getUserId();
  const [devices, setDevices] = useState<DeviceToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  // Form state
  const [token, setToken] = useState('');
  const [platform, setPlatform] = useState<Platform>('android');
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    setListError(null);
    try {
      const result = await api.listDevices(userId);
      setDevices(result.devices || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load devices';
      setListError(message);
      setDevices([]);
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [userId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setError(null);

    try {
      await api.registerDevice({ user_id: userId, token, platform });
      setToken('');
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async (deviceToken: string) => {
    if (confirm('Unregister this device?')) {
      try {
        await api.unregisterDevice(deviceToken);
        await loadDevices();
      } catch (err) {
        console.error('Failed to unregister:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">Push Devices</h1>
        <p className="text-[var(--text-secondary)]">Register devices for push notifications</p>
      </div>

      {/* Register Form */}
      <div className="card p-6 max-w-2xl">
        <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Register Device</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="label-base">Device Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="FCM or APNs token"
              className="input-base w-full mt-1 font-mono"
              required
            />
          </div>

          <div>
            <label className="label-base">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="input-base w-full mt-1">
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="web">Web</option>
            </select>
          </div>

          <button type="submit" disabled={registering} className="btn-primary w-full">
            {registering ? 'Registering...' : 'Register Device'}
          </button>

          {error && <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}
        </form>
      </div>

      {/* Devices List */}
      <div>
        <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Registered Devices ({devices.length})</h2>
        {listError && (
          <div className="mb-4 text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">
            {listError}
          </div>
        )}

        {loading ? (
          <div className="card p-6 text-center">Loading...</div>
        ) : devices.length === 0 ? (
          <div className="card p-6 text-center text-[var(--text-secondary)]">No devices registered</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  <th className="text-left p-3 font-semibold">Token</th>
                  <th className="text-left p-3 font-semibold">Platform</th>
                  <th className="text-left p-3 font-semibold">Registered</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border-color)]">
                    <td className="p-3 font-mono text-xs text-[var(--text-secondary)]">{d.token.slice(0, 30)}...</td>
                    <td className="p-3 capitalize">{d.platform}</td>
                    <td className="p-3 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleUnregister(d.token)} className="text-red-600 hover:font-semibold text-sm">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
