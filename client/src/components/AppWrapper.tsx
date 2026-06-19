'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { HealthStatus } from './HealthStatus';
import { Menu } from 'lucide-react';

export function AppWrapper({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const [authorized, setAuthorized] = useState<boolean | null>(null);
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	const normalizedPathname = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
	const isAuthPage = normalizedPathname === '/login' || normalizedPathname === '/signup';

	useEffect(() => {
		const token = localStorage.getItem('buzz_jwt_token');
		if (!token && !isAuthPage) {
			setAuthorized(false);
			router.push('/login');
		} else {
			setAuthorized(true);
		}
	}, [pathname, isAuthPage, router]);

	if (authorized === null) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
			</div>
		);
	}

	if (isAuthPage) {
		return (
			<div className="min-h-screen flex flex-col justify-center bg-[var(--bg-primary)]">
				{children}
			</div>
		);
	}

	return (
		<>
			<Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
			<HealthStatus />

			{/* Mobile Top Header */}
			<header className="md:hidden h-14 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4">
				<button
					onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
					className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none rounded-md hover:bg-[var(--bg-tertiary)]"
					title="Open Menu"
				>
					<Menu size={20} />
				</button>
				<div className="flex items-center gap-2">
					<img src="/BeetleCode-icon-red.svg" alt="Buzz Logo" className="w-5 h-5" />
					<span className="text-xs font-bold text-[var(--text-primary)] font-semibold">Buzz</span>
				</div>
				<div className="w-8 h-8" /> {/* spacer to align item center */}
			</header>

			<div className="md:ml-56 ml-0 pt-14 md:pt-0 min-h-screen flex flex-col">
				<main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
					{children}
				</main>
			</div>
		</>
	);
}
