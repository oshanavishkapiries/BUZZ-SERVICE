'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const res = await api.login({ email, password });
			localStorage.setItem('buzz_jwt_token', res.token);
			
			// Fetch user applications and set active one
			const appsRes = await api.listApplications();
			if (appsRes.applications && appsRes.applications.length > 0) {
				localStorage.setItem('buzz_active_app_id', appsRes.applications[0].id);
			} else {
				// Fallback if no applications exist
				localStorage.removeItem('buzz_active_app_id');
			}

			router.push('/');
			router.refresh();
		} catch (err: any) {
			setError(err.message || 'Invalid email or password');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4 bg-[var(--bg-primary)]">
			<div className="w-full max-w-md p-8 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl relative overflow-hidden">
				{/* Decorative background glow */}
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--accent)] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
				
				<div className="flex flex-col items-center mb-8 relative z-10">
					<img src="/BeetleCode-icon-red.svg" alt="Buzz Logo" className="w-12 h-12 mb-3" />
					<h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Welcome back</h1>
					<p className="text-sm text-[var(--text-muted)] mt-1">Sign in to your Buzz account</p>
				</div>

				{error && (
					<div className="mb-6 p-4 rounded-[var(--radius)] bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4 relative z-10">
					<div>
						<label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
							Email Address
						</label>
						<input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@company.com"
							className="w-full px-4 py-2.5 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
						/>
					</div>

					<div>
						<label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
							Password
						</label>
						<input
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="w-full px-4 py-2.5 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full py-3 px-4 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 active:scale-[0.99] text-white font-semibold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
					>
						{loading ? (
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
						) : (
							'Sign In'
						)}
					</button>
				</form>

				<div className="mt-6 text-center text-sm text-[var(--text-muted)] relative z-10">
					Need an account? Please contact your system administrator to get added.
				</div>
			</div>
		</div>
	);
}
