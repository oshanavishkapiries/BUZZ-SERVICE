'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { HealthStatus } from './HealthStatus';

export function AppWrapper({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const [authorized, setAuthorized] = useState<boolean | null>(null);

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
			<Sidebar />
			<HealthStatus />
			<div className="ml-56 min-h-screen flex flex-col">
				<main className="flex-1 p-8 max-w-6xl">
					{children}
				</main>
			</div>
		</>
	);
}
