'use client';

import Link from 'next/link';

export default function SignupPage() {
	return (
		<div className="flex min-h-screen items-center justify-center p-4 bg-[var(--bg-primary)]">
			<div className="w-full max-w-md p-8 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl relative overflow-hidden text-center">
				{/* Decorative background glow */}
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--accent)] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
				
				<div className="flex flex-col items-center mb-6 relative z-10">
					<img src="/BeetleCode-icon-red.svg" alt="Buzz Logo" className="w-12 h-12 mb-3" />
					<h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Registration Disabled</h1>
					<p className="text-sm text-[var(--text-muted)] mt-1">Self-service registration is turned off</p>
				</div>

				<div className="mb-8 p-4 rounded-[var(--radius)] bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm leading-relaxed relative z-10 text-left">
					To ensure strict workspace isolation, user registration is managed by system administrators. 
					Please contact your organization's system owner to create an account and assign you to your application workspaces.
				</div>

				<Link
					href="/login"
					className="inline-block w-full py-3 px-4 rounded-[var(--radius)] bg-[var(--accent)] hover:opacity-90 active:scale-[0.99] text-white font-semibold shadow-md transition-all relative z-10"
				>
					Return to Login
				</Link>
			</div>
		</div>
	);
}
