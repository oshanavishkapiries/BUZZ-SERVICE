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
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Base URL
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="http://localhost:8080"
          />
          <p className="text-xs text-gray-500 mt-1">
            The base URL of your Buzz Notification Service API
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            placeholder="buzz_..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Your Buzz API key (e.g., buzz_test_key_123)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="user-123"
          />
          <p className="text-xs text-gray-500 mt-1">
            The end-user ID for inbox and SSE subscriptions
          </p>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save Settings
        </button>

        {saved && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
            ✓ Settings saved successfully!
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ Current Configuration</h2>
        <div className="text-sm text-blue-800 space-y-1 font-mono">
          <p>API URL: {apiUrl}</p>
          <p>API Key: {apiKey ? '•'.repeat(10) : '(not set)'}</p>
          <p>User ID: {userId}</p>
        </div>
      </div>
    </div>
  );
}
