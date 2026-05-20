'use client';

import { useState, useEffect } from 'react';
import { getConfig, setConfig } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import * as Types from '@/lib/types';
import { Settings as SettingsIcon, Save, Eye, EyeOff, Plus, Trash2, Copy, Check, Key, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
	const [apiUrl, setApiUrl] = useState('');
	const [apiKey, setApiKey] = useState('');
	const [userId, setUserId] = useState('');
	const [saved, setSaved] = useState(false);
	const [showKey, setShowKey] = useState(false);

	// Multi-client / API Keys state
	const [activeAppId, setActiveAppId] = useState<string | null>(null);
	const [apiKeys, setApiKeys] = useState<Types.APIKey[]>([]);
	const [loadingKeys, setLoadingKeys] = useState(false);
	const [newKeyName, setNewKeyName] = useState('');
	const [newKeyEnv, setNewKeyEnv] = useState('production');
	const [newKeyScopes, setNewKeyScopes] = useState('*');
	const [generating, setGenerating] = useState(false);
	const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [keyError, setKeyError] = useState<string | null>(null);

	useEffect(() => {
		const c = getConfig();
		setApiUrl(c.apiUrl);
		setApiKey(c.apiKey);
		setUserId(c.userId);

		const appId = localStorage.getItem('buzz_active_app_id');
		setActiveAppId(appId);

		if (appId) {
			fetchAPIKeys(appId);
		}
	}, []);

	const fetchAPIKeys = async (appId: string) => {
		setLoadingKeys(true);
		try {
			const res = await api.listAPIKeys(appId);
			setApiKeys(res.api_keys);
		} catch (err: any) {
			console.error('Failed to load API keys:', err);
		} finally {
			setLoadingKeys(false);
		}
	};

	const handleSave = () => {
		setConfig(apiUrl, apiKey, userId);
		setSaved(true);
		setTimeout(() => setSaved(false), 3000);
	};

	const handleCreateKey = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!activeAppId) return;

		setKeyError(null);
		setGenerating(true);
		setGeneratedRawKey(null);

		try {
			const scopesList = newKeyScopes.split(',').map(s => s.trim()).filter(s => s !== '');
			const res = await api.createAPIKey(activeAppId, {
				name: newKeyName,
				environment: newKeyEnv,
				scopes: scopesList.length > 0 ? scopesList : ['*']
			});

			setGeneratedRawKey(res.raw_key);
			setNewKeyName('');
			fetchAPIKeys(activeAppId);
		} catch (err: any) {
			setKeyError(err.message || 'Failed to generate API key');
		} finally {
			setGenerating(false);
		}
	};

	const handleDeleteKey = async (keyId: string) => {
		if (!activeAppId) return;
		if (!confirm('Are you sure you want to revoke this API key? This action is irreversible.')) return;

		try {
			await api.deleteAPIKey(activeAppId, keyId);
			fetchAPIKeys(activeAppId);
		} catch (err: any) {
			alert(err.message || 'Failed to delete API key');
		}
	};

	const handleCopy = () => {
		if (!generatedRawKey) return;
		navigator.clipboard.writeText(generatedRawKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="space-y-6 max-w-4xl">
			<div className="page-header">
				<h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
				<p className="text-sm text-[var(--text-secondary)] mt-1">Configure your Buzz profile and API access keys</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Left Column: API Client Configuration */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<SettingsIcon size={14} className="text-[var(--accent)]" />
								Dashboard configuration
							</CardTitle>
							<CardDescription>Configure local workspace variables.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<div>
								<Label htmlFor="apiUrl">API Base URL</Label>
								<Input
									id="apiUrl"
									value={apiUrl}
									onChange={e => setApiUrl(e.target.value)}
									placeholder="http://localhost:8080"
									className="mt-1"
								/>
								<p className="text-xs text-[var(--text-muted)] mt-1">Base URL of your Buzz service</p>
							</div>

							<div>
								<Label htmlFor="apiKey">Developer API Key Override</Label>
								<div className="relative mt-1">
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
								<p className="text-xs text-[var(--text-muted)] mt-1">Fallback token for dashboard request simulation</p>
							</div>

							<div>
								<Label htmlFor="userId">User ID</Label>
								<Input
									id="userId"
									value={userId}
									onChange={e => setUserId(e.target.value)}
									placeholder="user-123"
									className="mt-1"
								/>
								<p className="text-xs text-[var(--text-muted)] mt-1">Used for inbox and SSE subscriptions</p>
							</div>

							<Button onClick={handleSave} className="w-full">
								<Save size={14} />
								Save Local Configuration
							</Button>

							{saved && (
								<Alert variant="success">
									<AlertDescription>Settings saved successfully.</AlertDescription>
								</Alert>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Right Column: Manage API keys of the active application */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Key size={14} className="text-[var(--accent)]" />
								Application API Keys
							</CardTitle>
							<CardDescription>
								Generate credentials for external programs to communicate with this workspace.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{activeAppId ? (
								<>
									{/* API Key Generation Form */}
									<form onSubmit={handleCreateKey} className="space-y-3 p-4 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)]">
										<div className="text-xs font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wide">Generate Credentials</div>
										
										<div>
											<Label htmlFor="keyName" className="text-xs">Key Name</Label>
											<Input
												id="keyName"
												required
												value={newKeyName}
												onChange={e => setNewKeyName(e.target.value)}
												placeholder="e.g. Production Backend"
												className="h-8 text-xs mt-1"
											/>
										</div>

										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label htmlFor="keyEnv" className="text-xs">Environment</Label>
												<select
													id="keyEnv"
													value={newKeyEnv}
													onChange={e => setNewKeyEnv(e.target.value)}
													className="w-full h-8 text-xs px-2.5 mt-1 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none"
												>
													<option value="production">Production</option>
													<option value="staging">Staging</option>
													<option value="development">Development</option>
													<option value="test">Test</option>
												</select>
											</div>
											<div>
												<Label htmlFor="keyScopes" className="text-xs font-semibold">Scopes</Label>
												<Input
													id="keyScopes"
													value={newKeyScopes}
													onChange={e => setNewKeyScopes(e.target.value)}
													placeholder="*, notification:send"
													className="h-8 text-xs mt-1"
												/>
											</div>
										</div>

										{keyError && (
											<div className="text-xs text-red-500">{keyError}</div>
										)}

										<Button type="submit" disabled={generating} className="w-full h-8 text-xs mt-2">
											{generating ? 'Generating...' : 'Generate New Key'}
										</Button>
									</form>

									{/* Newly Generated Raw Key Display */}
									{generatedRawKey && (
										<div className="p-3.5 rounded-[var(--radius)] border border-yellow-500/20 bg-yellow-500/5 space-y-2 animate-in fade-in duration-200">
											<div className="text-xs font-bold text-yellow-600 dark:text-yellow-400">Copy this key now!</div>
											<div className="text-[0.65rem] text-[var(--text-muted)] leading-tight">
												For security reasons, this key will not be shown again.
											</div>
											<div className="flex items-center gap-2 mt-1">
												<code className="flex-1 p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] font-mono break-all select-all">
													{generatedRawKey}
												</code>
												<button
													onClick={handleCopy}
													className="p-2 rounded border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-all shrink-0"
												>
													{copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
												</button>
											</div>
										</div>
									)}

									{/* List of Existing Keys */}
									<div className="space-y-2 mt-4">
										<div className="flex items-center justify-between">
											<div className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">Active API Keys</div>
											<button 
												onClick={() => fetchAPIKeys(activeAppId)} 
												disabled={loadingKeys}
												className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
											>
												<RefreshCw size={12} className={loadingKeys ? 'animate-spin' : ''} />
											</button>
										</div>

										{loadingKeys ? (
											<div className="text-center text-xs text-[var(--text-muted)] py-4">Loading keys...</div>
										) : apiKeys.length === 0 ? (
											<div className="text-center text-xs text-[var(--text-muted)] py-6 border border-dashed border-[var(--border-color)] rounded-[var(--radius)]">
												No credentials found for this application workspace.
											</div>
										) : (
											<div className="space-y-2 max-h-72 overflow-y-auto">
												{apiKeys.map((key) => (
													<div key={key.id} className="flex items-center justify-between p-3 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent)] transition-all">
														<div className="overflow-hidden leading-tight pr-2">
															<div className="text-xs font-bold text-[var(--text-primary)] truncate">{key.name}</div>
															<div className="flex items-center gap-1.5 mt-1 flex-wrap">
																<span className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
																	{key.key_prefix}...
																</span>
																<span className={`text-[0.55rem] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
																	key.environment === 'production' 
																		? 'bg-red-500/10 text-red-500 border border-red-500/20' 
																		: 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
																}`}>
																	{key.environment}
																</span>
															</div>
														</div>
														<button
															onClick={() => handleDeleteKey(key.id)}
															className="text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors shrink-0"
															title="Revoke Key"
														>
															<Trash2 size={13} />
														</button>
													</div>
												))}
											</div>
										)}
									</div>
								</>
							) : (
								<div className="text-center text-xs text-[var(--text-muted)] py-6">
									Please sign in to manage API keys.
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
