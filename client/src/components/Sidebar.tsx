'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeSwitcher } from './ThemeSwitcher';
import { api } from '@/lib/api';
import * as Types from '@/lib/types';
import {
	LayoutDashboard,
	Bell,
	Radio,
	Inbox,
	FileText,
	Smartphone,
	Layers,
	Database,
	BookOpen,
	Settings,
	Zap,
	ChevronDown,
	Plus,
	LogOut,
	Folder,
	User,
} from 'lucide-react';

const navItems = [
	{ href: '/',              label: 'Dashboard',     icon: LayoutDashboard },
	{ href: '/notifications', label: 'Notifications', icon: Bell },
	{ href: '/stream',        label: 'Live Stream',   icon: Radio },
	{ href: '/inbox',         label: 'Inbox',         icon: Inbox },
	{ href: '/templates',     label: 'Templates',     icon: FileText },
	{ href: '/devices',       label: 'Devices',       icon: Smartphone },
	{ href: '/batches',       label: 'Batches',       icon: Layers },
	{ href: '/datasources',   label: 'Datasources',   icon: Database },
	{ href: '/providers',     label: 'Providers',     icon: Zap },
];

const bottomItems = [
	{ href: '/docs',     label: 'Docs',     icon: BookOpen },
	{ href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
	const pathname = usePathname();
	const router = useRouter();
	
	const [user, setUser] = useState<Types.User | null>(null);
	const [applications, setApplications] = useState<Types.Application[]>([]);
	const [activeApp, setActiveApp] = useState<Types.Application | null>(null);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	
	// Create app form state
	const [newAppName, setNewAppName] = useState('');
	const [newAppDesc, setNewAppDesc] = useState('');
	const [createLoading, setCreateLoading] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	useEffect(() => {
		const token = localStorage.getItem('buzz_jwt_token');
		if (!token) return;

		// Fetch profile and applications
		Promise.all([
			api.getMe().catch(() => null),
			api.listApplications().catch(() => null)
		]).then(([userRes, appsRes]) => {
			if (userRes && userRes.user) {
				setUser(userRes.user);
			}
			if (appsRes && appsRes.applications) {
				setApplications(appsRes.applications);
				
				const storedAppId = localStorage.getItem('buzz_active_app_id');
				const foundApp = appsRes.applications.find((a: Types.Application) => a.id === storedAppId);
				
				if (foundApp) {
					setActiveApp(foundApp);
				} else if (appsRes.applications.length > 0) {
					setActiveApp(appsRes.applications[0]);
					localStorage.setItem('buzz_active_app_id', appsRes.applications[0].id);
				}
			}
		});
	}, [pathname]);

	const isActive = (href: string) =>
		href === '/'
			? pathname === '/'
			: pathname === href || pathname.startsWith(href + '/');

	const dynamicNavItems = [...navItems];
	const dynamicBottomItems = [...bottomItems];

	if (user && user.role === 'owner') {
		dynamicBottomItems.splice(1, 0, { href: '/users', label: 'Users', icon: User });
	}

	const handleSwitchApp = (app: Types.Application) => {
		localStorage.setItem('buzz_active_app_id', app.id);
		setActiveApp(app);
		setIsDropdownOpen(false);
		window.location.reload();
	};

	const handleCreateApp = async (e: React.FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		setCreateLoading(true);

		try {
			const res = await api.createApplication({
				name: newAppName,
				description: newAppDesc || undefined
			});
			
			const newApp = res.application;
			setApplications(prev => [...prev, newApp]);
			localStorage.setItem('buzz_active_app_id', newApp.id);
			setActiveApp(newApp);
			setIsModalOpen(false);
			setNewAppName('');
			setNewAppDesc('');
			window.location.reload();
		} catch (err: any) {
			setCreateError(err.message || 'Failed to create application');
		} finally {
			setCreateLoading(false);
		}
	};

	const handleLogout = () => {
		localStorage.removeItem('buzz_jwt_token');
		localStorage.removeItem('buzz_active_app_id');
		router.push('/login');
		router.refresh();
	};

	return (
		<>
			<aside className="w-56 h-screen fixed left-0 top-0 flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)] z-30">
				{/* Logo */}
				<div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--border-color)]">
					<div className="flex items-center justify-center w-7 h-7 shrink-0">
						<img src="/client/BeetleCode-icon-red.svg" alt="BeetleCode" className="w-6 h-6" />
					</div>
					<div>
						<div className="text-sm font-bold text-[var(--text-primary)] leading-none">Buzz</div>
						<div className="text-[0.65rem] text-[var(--text-muted)] mt-0.5">Service Client</div>
					</div>
				</div>

				{/* Application Switcher Dropdown */}
				{activeApp ? (
					<div className="px-3 py-3 border-b border-[var(--border-color)] relative" ref={dropdownRef}>
						<button
							onClick={() => setIsDropdownOpen(!isDropdownOpen)}
							className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
						>
							<div className="flex items-center gap-2 overflow-hidden">
								<Folder size={15} className="text-[var(--accent)] shrink-0" />
								<span className="text-xs font-semibold text-[var(--text-primary)] truncate">
									{activeApp.name}
								</span>
							</div>
							<ChevronDown size={14} className="text-[var(--text-muted)] shrink-0 transition-transform duration-200" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }} />
						</button>

						{/* Custom Dropdown Menu */}
						{isDropdownOpen && (
							<div className="absolute left-3 right-3 mt-1 py-1 rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl z-40 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
								<div className="px-2.5 py-1 text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">
									Switch Application
								</div>
								{applications.map((app) => (
									<button
										key={app.id}
										onClick={() => handleSwitchApp(app)}
										className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left ${
											app.id === activeApp.id ? 'bg-[var(--bg-tertiary)] font-semibold border-l-2 border-[var(--accent)]' : ''
										}`}
									>
										<span className="truncate">{app.name}</span>
									</button>
								))}
								<div className="border-t border-[var(--border-color)] mt-1 pt-1">
									<button
										onClick={() => {
											setIsDropdownOpen(false);
											setIsModalOpen(true);
										}}
										className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--accent)] hover:bg-[var(--bg-tertiary)] font-semibold transition-colors text-left"
									>
										<Plus size={14} />
										Create Application
									</button>
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="px-3 py-3 border-b border-[var(--border-color)]">
						<button
							onClick={() => setIsModalOpen(true)}
							className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--radius)] border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent)] text-[var(--accent)] transition-all text-xs font-semibold"
						>
							<Plus size={14} className="shrink-0" />
							Create Workspace
						</button>
					</div>
				)}

				{/* Primary nav */}
				<nav className="flex-1 overflow-y-auto py-3 px-2">
					<div className="space-y-0.5">
						{dynamicNavItems.map(({ href, label, icon: Icon }) => {
							const active = isActive(href);
							return (
								<Link
									key={href}
									href={href}
									className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius)] text-sm transition-colors ${
										active
											? 'bg-[var(--accent)] text-white font-medium shadow-sm'
											: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
									}`}
								>
									<Icon size={15} className="shrink-0" />
									{label}
								</Link>
							);
						})}
					</div>
				</nav>

				{/* Bottom section */}
				<div className="border-t border-[var(--border-color)] p-2 bg-[var(--bg-secondary)]">
					{/* User Profile Summary */}
					{user && (
						<div className="flex items-center justify-between px-3 py-2.5 mb-2 rounded-[var(--radius)] bg-[var(--bg-primary)] border border-[var(--border-color)]">
							<div className="flex items-center gap-2 overflow-hidden">
								<div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[0.7rem] font-bold uppercase shrink-0">
									{user.name.charAt(0)}
								</div>
								<div className="overflow-hidden leading-tight">
									<div className="text-[0.75rem] font-semibold text-[var(--text-primary)] truncate">{user.name}</div>
									<div className="text-[0.6rem] text-[var(--text-muted)] truncate">{user.email}</div>
								</div>
							</div>
							<button 
								onClick={handleLogout}
								title="Log Out"
								className="text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors shrink-0"
							>
								<LogOut size={13} />
							</button>
						</div>
					)}

					<div className="space-y-0.5">
						{dynamicBottomItems.map(({ href, label, icon: Icon }) => {
							const active = isActive(href);
							return (
								<Link
									key={href}
									href={href}
									className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius)] text-sm transition-colors ${
										active
											? 'bg-[var(--accent)] text-white font-medium'
											: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
									}`}
								>
									<Icon size={15} className="shrink-0" />
									{label}
								</Link>
							);
						})}
					</div>
					<div className="flex items-center justify-between mt-2 px-3 py-2">
						<span className="text-[0.7rem] text-[var(--text-muted)] font-medium uppercase tracking-wide">Theme</span>
						<ThemeSwitcher />
					</div>
				</div>
			</aside>

			{/* Create Application Modal */}
			{isModalOpen && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
					<div className="w-full max-w-md p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
						<h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Create New Application</h2>
						<p className="text-xs text-[var(--text-muted)] mb-5">Applications partition your templates, providers, and logs into distinct spaces.</p>

						{createError && (
							<div className="mb-4 p-3 rounded-[var(--radius)] bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
								{createError}
							</div>
						)}

						<form onSubmit={handleCreateApp} className="space-y-4">
							<div>
								<label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
									Application Name
								</label>
								<input
									type="text"
									required
									value={newAppName}
									onChange={(e) => setNewAppName(e.target.value)}
									placeholder="e.g. LMS Project, Marketing Portal"
									className="w-full px-3 py-2 text-sm rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
								/>
							</div>

							<div>
								<label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
									Description (Optional)
								</label>
								<textarea
									value={newAppDesc}
									onChange={(e) => setNewAppDesc(e.target.value)}
									placeholder="What is this application for?"
									rows={3}
									className="w-full px-3 py-2 text-sm rounded-[var(--radius)] border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
								/>
							</div>

							<div className="flex items-center justify-end gap-3 mt-6">
								<button
									type="button"
									onClick={() => setIsModalOpen(false)}
									className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-[var(--radius)] transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createLoading}
									className="px-4 py-2 text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 active:scale-[0.98] rounded-[var(--radius)] shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
								>
									{createLoading ? (
										<div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
									) : (
										'Create'
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
