'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function HealthStatus() {
  const [status, setStatus] = useState<'loading' | 'up' | 'down'>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        await api.getHealth();
        setStatus('up');
      } catch {
        setStatus('down');
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  if (status === 'loading') return null;

  return (
    <div
      className={`fixed top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius)] border text-xs font-medium z-50 ${
        status === 'up'
          ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400'
          : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
      {status === 'up' ? 'API Connected' : 'API Offline'}
    </div>
  );
}
