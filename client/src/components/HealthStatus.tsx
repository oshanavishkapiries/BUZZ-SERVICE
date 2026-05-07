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
    const interval = setInterval(checkHealth, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (healthy === null) return null;

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md">
      <div className={`w-3 h-3 rounded-full ${healthy ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm font-medium">
        {healthy ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}
