'use client';

import { useState, useEffect } from 'react';
import { getConfig, setConfig } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings as SettingsIcon, Save, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const c = getConfig();
    setApiUrl(c.apiUrl);
    setApiKey(c.apiKey);
    setUserId(c.userId);
  }, []);

  const handleSave = () => {
    setConfig(apiUrl, apiKey, userId);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Configure your API connection</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon size={14} className="text-[var(--accent)]" />
            API Configuration
          </CardTitle>
          <CardDescription>Settings are stored in your browser&apos;s localStorage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="apiUrl">API Base URL</Label>
            <Input
              id="apiUrl"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="http://localhost:8080"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Base URL of your Buzz service</p>
          </div>

          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="buzz_..."
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="user-123"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Used for inbox and SSE subscriptions</p>
          </div>

          <Button onClick={handleSave} className="w-full">
            <Save size={14} />
            Save Settings
          </Button>

          {saved && (
            <Alert variant="success">
              <AlertDescription>Settings saved successfully.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Current config display */}
      <Card>
        <CardHeader>
          <CardTitle>Active Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 font-mono text-xs">
            {[
              ['API_URL',  apiUrl  || '(not set)'],
              ['API_KEY',  apiKey  ? '•'.repeat(Math.min(apiKey.length, 20)) : '(not set)'],
              ['USER_ID',  userId  || '(not set)'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 py-1.5 border-b border-[var(--border-color)] last:border-0">
                <span className="text-[var(--text-muted)] w-20 shrink-0">{k}</span>
                <span className="text-[var(--text-primary)] truncate">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
