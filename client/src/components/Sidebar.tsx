'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeSwitcher } from './ThemeSwitcher';
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
];

const bottomItems = [
  { href: '/docs',     label: 'Docs',     icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="w-56 h-screen fixed left-0 top-0 flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-center w-7 h-7 rounded-[var(--radius)] bg-[var(--accent)] text-white shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--text-primary)] leading-none">Buzz</div>
          <div className="text-[0.65rem] text-[var(--text-muted)] mt-0.5">Service Client</div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
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
      <div className="border-t border-[var(--border-color)] p-2">
        <div className="space-y-0.5">
          {bottomItems.map(({ href, label, icon: Icon }) => {
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
  );
}
