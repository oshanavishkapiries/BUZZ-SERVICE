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
    <div className={`status-pill fixed top-4 right-4 z-50 ${status === 'up' ? 'status-pill-up' : 'status-pill-down'}`}>
      <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', flexShrink: 0,
        background: status === 'up' ? '#16a34a' : '#dc2626' }} />
      {status === 'up' ? 'API Connected' : 'API Offline'}
    </div>
  );
}
