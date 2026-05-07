'use client';

import { useState, useEffect } from 'react';
import { getConfig, setConfig } from '@/lib/config';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const config = getConfig();
    setApiUrl(config.apiUrl);
    setApiKey(config.apiKey);
    setUserId(config.userId);
  }, []);

  const handleSave = () => {
    setConfig(apiUrl, apiKey, userId);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-[var(--text-primary)]">Settings</h1>

      <div className="card p-6 space-y-6">
        <div>
          <label className="label-base">API Base URL</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="input-base w-full mt-1"
            placeholder="http://localhost:8080"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            The base URL of your Buzz Notification Service API
          </p>
        </div>

        <div>
          <label className="label-base">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-base w-full mt-1 font-mono"
            placeholder="buzz_..."
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Your Buzz API key (e.g., buzz_test_key_123)
          </p>
        </div>

        <div>
          <label className="label-base">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input-base w-full mt-1"
            placeholder="user-123"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            The end-user ID for inbox and SSE subscriptions
          </p>
        </div>

        <button onClick={handleSave} className="btn-primary w-full">
          Save Settings
        </button>

        {saved && (
          <div className="border border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
            Settings saved successfully!
          </div>
        )}
      </div>

      <div className="mt-8 card border border-[var(--accent)] p-6 bg-[var(--bg-secondary)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Current Configuration</h2>
        <div className="text-sm space-y-1 font-mono text-[var(--text-secondary)]">
          <p>API URL: <span className="text-[var(--text-primary)]">{apiUrl}</span></p>
          <p>API Key: <span className="text-[var(--text-primary)]">{apiKey ? '•'.repeat(10) : '(not set)'}</span></p>
          <p>User ID: <span className="text-[var(--text-primary)]">{userId}</span></p>
        </div>
      </div>
    </div>
  );
}
