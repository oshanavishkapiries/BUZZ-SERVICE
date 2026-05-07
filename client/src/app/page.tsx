'use client';

import { NotificationMatrix } from '@/components/NotificationMatrix';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { HealthResponse } from '@/lib/types';

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const result = await api.getHealth();
        setHealth(result);
      } catch (err) {
        console.error('Failed to fetch health:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-[var(--text-secondary)]">Monitor your Buzz Notification Service in real-time</p>
      </div>

      {/* Health Status Card */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4 text-[var(--text-primary)]">Service Health</h2>
        {loading ? (
          <div className="animate-pulse h-20 bg-[var(--bg-secondary)] rounded" />
        ) : health ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Status:</span>
              <span className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-semibold capitalize text-[var(--text-primary)]">{health.status}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Version:</span>
              <span className="font-semibold text-[var(--text-primary)]">{health.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Database:</span>
              <span className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${health.checks.database === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-semibold capitalize text-[var(--text-primary)]">{health.checks.database}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-red-600">Failed to fetch health status</div>
        )}
      </div>

      {/* Notification Matrix */}
      <NotificationMatrix />

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-6 text-[var(--text-primary)]">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <a
            href="/notifications"
            className="p-6 border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors hover:bg-[var(--bg-secondary)]"
          >
            <div className="font-semibold text-[var(--text-primary)] mb-1">Send Notification</div>
            <div className="text-sm text-[var(--text-secondary)]">Test a single notification</div>
          </a>
          <a
            href="/stream"
            className="p-6 border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors hover:bg-[var(--bg-secondary)]"
          >
            <div className="font-semibold text-[var(--text-primary)] mb-1">Live Stream</div>
            <div className="text-sm text-[var(--text-secondary)]">Watch real-time events</div>
          </a>
          <a
            href="/templates"
            className="p-6 border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors hover:bg-[var(--bg-secondary)]"
          >
            <div className="font-semibold text-[var(--text-primary)] mb-1">Templates</div>
            <div className="text-sm text-[var(--text-secondary)]">Create and manage templates</div>
          </a>
          <a
            href="/batches"
            className="p-6 border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors hover:bg-[var(--bg-secondary)]"
          >
            <div className="font-semibold text-[var(--text-primary)] mb-1">Batch Jobs</div>
            <div className="text-sm text-[var(--text-secondary)]">Send bulk notifications</div>
          </a>
        </div>
      </div>
    </div>
  );
}
