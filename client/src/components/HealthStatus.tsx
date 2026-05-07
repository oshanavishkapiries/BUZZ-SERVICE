'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function HealthStatus() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.getHealth();
        setHealthy(true);
      } catch {
        setHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (healthy === null) return null;

  return (
    <div className="fixed top-6 right-6 flex items-center gap-3 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded shadow-jupyter">
      <div className={`w-2 h-2 rounded-full ${healthy ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-[var(--text-primary)]">
        {healthy ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}
