'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Channel, NotificationStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Grid3X3 } from 'lucide-react';

const CHANNELS: Channel[] = ['email', 'sms', 'push', 'in_app'];
const STATUSES: NotificationStatus[] = ['queued', 'processing', 'sent', 'delivered', 'failed'];

type Matrix = Record<string, Record<string, number>>;

function cellStyle(n: number): string {
  if (n === 0) return 'text-[var(--text-muted)]';
  if (n < 5)   return 'text-[var(--accent)] font-medium';
  if (n < 50)  return 'text-[var(--accent)] font-semibold';
  return 'text-[var(--accent)] font-bold';
}

export function NotificationMatrix() {
  const [data, setData] = useState<Matrix>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result: Matrix = {};
      for (const ch of CHANNELS) {
        result[ch] = {};
        for (const st of STATUSES) {
          result[ch][st] = await api.countNotifications(ch, st);
        }
      }
      setData(result);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 size={14} className="text-[var(--accent)]" />
            Notification Matrix
          </CardTitle>
          <div className="flex items-center gap-3">
            {lastFetch && (
              <span className="text-[0.7rem] text-[var(--text-muted)]">
                Updated {lastFetch.toLocaleTimeString()}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="h-7 w-7">
              <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)] mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>Retry</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  {STATUSES.map(s => <th key={s}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map(ch => (
                  <tr key={ch}>
                    <td className="font-medium capitalize">
                      {ch.replace('_', ' ')}
                    </td>
                    {STATUSES.map(st => {
                      const n = data[ch]?.[st] ?? 0;
                      return (
                        <td key={st} className={`tabular-nums ${cellStyle(n)}`}>
                          {loading ? (
                            <div className="h-3 w-6 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                          ) : n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
