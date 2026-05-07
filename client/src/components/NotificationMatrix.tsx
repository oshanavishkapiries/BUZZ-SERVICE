'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Channel, NotificationStatus } from '@/lib/types';

const channels: Channel[] = ['email', 'sms', 'push', 'in_app'];
const statuses: NotificationStatus[] = ['queued', 'processing', 'sent', 'delivered', 'failed'];

interface MatrixData {
  [channel: string]: {
    [status: string]: number;
  };
}

export function NotificationMatrix() {
  const [data, setData] = useState<MatrixData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const newData: MatrixData = {};

      for (const channel of channels) {
        newData[channel] = {};
        for (const status of statuses) {
          const count = await api.countNotifications(channel, status);
          newData[channel][status] = count;
        }
      }

      setData(newData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch matrix data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4 text-[var(--text-primary)]">Notification Status Matrix</h2>
        <div className="animate-pulse flex flex-col space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-[var(--bg-secondary)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-400 p-4 text-red-700 dark:text-red-400">
        Error: {error}
        <button onClick={fetchData} className="ml-2 underline hover:font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const getColor = (value: number): string => {
    if (value === 0) return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
    if (value < 5) return 'bg-[var(--accent)] text-white opacity-30';
    if (value < 20) return 'bg-[var(--accent)] text-white opacity-50';
    if (value < 50) return 'bg-[var(--accent)] text-white opacity-70';
    return 'bg-[var(--accent)] text-white';
  };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4 text-[var(--text-primary)]">Notification Status Matrix</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="text-left py-3 px-4 font-semibold text-[var(--text-primary)]">Channel</th>
              {statuses.map((status) => (
                <th
                  key={status}
                  className="text-center py-3 px-4 font-semibold text-[var(--text-primary)] capitalize"
                >
                  {status}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => (
              <tr key={channel} className="border-b border-[var(--border-color)] last:border-0">
                <td className="py-3 px-4 font-medium text-[var(--text-primary)] capitalize">{channel}</td>
                {statuses.map((status) => {
                  const count = data[channel]?.[status] || 0;
                  return (
                    <td key={`${channel}-${status}`} className="text-center py-3 px-4">
                      <div className={`inline-block px-3 py-1 rounded font-semibold ${getColor(count)}`}>
                        {count}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-4">Auto-refreshes every 30 seconds</p>
    </div>
  );
}
