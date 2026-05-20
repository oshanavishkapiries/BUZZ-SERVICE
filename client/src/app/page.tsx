'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { HealthResponse } from '@/lib/types';
import { NotificationMatrix } from '@/components/NotificationMatrix';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Radio, Inbox, FileText, Layers, Database, Activity, Users } from 'lucide-react';

const quickLinks = [
  { href: '/notifications', label: 'Send Notification', description: 'Trigger a single notification', icon: Bell },
  { href: '/stream',        label: 'Live Stream',        description: 'Watch SSE events in real time',  icon: Radio },
  { href: '/inbox',         label: 'Inbox',              description: 'In-app messages for this user',  icon: Inbox },
  { href: '/templates',     label: 'Templates',          description: 'Manage reusable templates',      icon: FileText },
  { href: '/batches',       label: 'Batches',            description: 'Send bulk notifications',        icon: Layers },
];

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [hasActiveApp, setHasActiveApp] = useState<boolean>(true);

  useEffect(() => {
    const activeAppId = localStorage.getItem('buzz_active_app_id');
    setHasActiveApp(!!activeAppId);

    api.getHealth()
      .then(setHealth)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to reach service'))
      .finally(() => setLoading(false));

    api.getMe()
      .then(res => {
        if (res && res.user) {
          setUser(res.user);
        }
      })
      .catch(() => {});

    const fetchOnline = () => {
      api.getOnlineStats()
        .then(s => setOnlineUsers(s.online_users))
        .catch(() => {});
    };
    fetchOnline();
    const t = setInterval(fetchOnline, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Overview of your Buzz Notification Service</p>
        </div>
        {onlineUsers !== null && (
          <div className="status-pill status-pill-up">
            <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', flexShrink: 0,
              background: '#16a34a', animation: 'pulse 2s infinite' }} />
            {onlineUsers} online
          </div>
        )}
      </div>

      {!hasActiveApp && (
        <Alert className="bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]">
          <AlertDescription className="font-semibold text-xs flex items-center justify-between">
            <span>You do not have an active application workspace. Please click "Create Workspace" in the sidebar to create one, or verify that your account has been granted permissions to an existing workspace.</span>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Service health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={14} className="text-[var(--accent)]" />
            Service Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-5 w-full bg-[var(--bg-tertiary)] rounded animate-pulse" />
              ))}
            </div>
          ) : health ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium capitalize">{health.status}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Version</div>
                <div className="text-sm font-mono">{health.version}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Database</div>
                <div className="flex items-center gap-2">
                  <Database size={12} className={health.checks.database === 'up' ? 'text-green-500' : 'text-red-500'} />
                  <Badge variant={health.checks.database === 'up' ? 'success' : 'destructive'}>
                    {health.checks.database}
                  </Badge>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Notification matrix */}
      <NotificationMatrix />

      {/* Quick links */}
      {(() => {
        const currentQuickLinks = [...quickLinks];
        if (user && user.role === 'owner') {
          currentQuickLinks.push({
            href: '/users',
            label: 'Users & Workspaces',
            description: 'Manage user accounts and workspace access',
            icon: Users,
          });
        }
        return (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Quick Links</h2>
            <div className="grid grid-cols-3 gap-3">
              {currentQuickLinks.map(({ href, label, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-start gap-3 p-4 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--surface-1)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-md)] transition-all"
                >
                  <div className="mt-0.5 flex items-center justify-center w-7 h-7 rounded-[var(--radius)] bg-[var(--accent-subtle)] text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors shrink-0">
                    <Icon size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
