'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Template, Channel } from '@/lib/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'create'>('list');

  // Form state
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    setListError(null);
    try {
      const result = await api.listTemplates({ limit: 100 });
      setTemplates(result.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setListError(message);
      setTemplates([]);
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      await api.createTemplate({
        name,
        channel,
        subject: subject || undefined,
        body,
        variables: variables.split(',').map((v) => v.trim()).filter(Boolean),
      });
      setName('');
      setSubject('');
      setBody('');
      setVariables('');
      setTab('list');
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (confirm('Delete this template?')) {
      try {
        await api.deleteTemplate(name);
        await loadTemplates();
      } catch (err) {
        console.error('Failed to delete:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]">Templates</h1>
        <p className="text-[var(--text-secondary)]">Manage reusable notification templates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[var(--border-color)]">
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-3 font-medium transition-colors ${
            tab === 'list'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab('create')}
          className={`px-4 py-3 font-medium transition-colors ${
            tab === 'create'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Create
        </button>
      </div>

      {tab === 'list' && (
        <>
          {listError && (
            <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">
              {listError}
            </div>
          )}

          {loading ? (
            <div className="card p-6 text-center">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="card p-6 text-center text-[var(--text-secondary)]">No templates found</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold">Channel</th>
                    <th className="text-left p-3 font-semibold">Variables</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--border-color)]">
                      <td className="p-3 font-medium">{t.name}</td>
                      <td className="p-3 capitalize">{t.channels.join(', ')}</td>
                      <td className="p-3 text-xs font-mono text-[var(--text-secondary)]">
                        {t.variables.join(', ') || 'None'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDelete(t.name)}
                          className="text-red-600 hover:font-semibold text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'create' && (
        <div className="card p-6 max-w-2xl">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label-base">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="welcome_email"
                className="input-base w-full mt-1"
                required
              />
            </div>

            <div>
              <label className="label-base">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="input-base w-full mt-1">
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
                <option value="in_app">In-App</option>
              </select>
            </div>

            {channel === 'email' && (
              <div>
                <label className="label-base">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Welcome {{name}}!"
                  className="input-base w-full mt-1"
                  required
                />
              </div>
            )}

            <div>
              <label className="label-base">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hello {{name}}, welcome!"
                className="input-base w-full mt-1 min-h-24"
                required
              />
            </div>

            <div>
              <label className="label-base">Variables (comma-separated)</label>
              <input
                type="text"
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                placeholder="name, company, url"
                className="input-base w-full mt-1"
              />
            </div>

            <button type="submit" disabled={creating} className="btn-primary w-full">
              {creating ? 'Creating...' : 'Create Template'}
            </button>

            {error && <div className="text-red-600 dark:text-red-400 text-sm border border-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded">{error}</div>}
          </form>
        </div>
      )}
    </div>
  );
}
