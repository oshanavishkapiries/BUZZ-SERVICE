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
        <p className="text-gray-600">Monitor your Buzz Notification Service in real-time</p>
      </div>

      {/* Health Status Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">Service Health</h2>
        {loading ? (
          <div className="animate-pulse h-20 bg-gray-200 rounded" />
        ) : health ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-semibold capitalize">{health.status}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Version:</span>
              <span className="font-semibold">{health.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Database:</span>
              <span className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${health.checks.database === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-semibold capitalize">{health.checks.database}</span>
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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <a
            href="/notifications"
            className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-center"
          >
            <div className="text-2xl mb-2">🔔</div>
            <div className="font-semibold">Send Notification</div>
            <div className="text-sm text-gray-600">Test a single notification</div>
          </a>
          <a
            href="/stream"
            className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors text-center"
          >
            <div className="text-2xl mb-2">📡</div>
            <div className="font-semibold">Live Stream</div>
            <div className="text-sm text-gray-600">Watch real-time events</div>
          </a>
          <a
            href="/templates"
            className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-center"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold">Templates</div>
            <div className="text-sm text-gray-600">Create and manage templates</div>
          </a>
          <a
            href="/batches"
            className="p-4 border-2 border-orange-200 rounded-lg hover:bg-orange-50 transition-colors text-center"
          >
            <div className="text-2xl mb-2">📦</div>
            <div className="font-semibold">Batch Jobs</div>
            <div className="text-sm text-gray-600">Send bulk notifications</div>
          </a>
        </div>
      </div>
    </div>
  );
}
