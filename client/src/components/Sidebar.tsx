'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeSwitcher } from './ThemeSwitcher';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/stream', label: 'Live Stream' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/templates', label: 'Templates' },
  { href: '/devices', label: 'Devices' },
  { href: '/batches', label: 'Batches' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-64 h-screen fixed left-0 top-0 border-r border-[var(--border-color)] bg-[var(--bg-primary)] overflow-y-auto">
      <div className="p-6 border-b border-[var(--border-color)]">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Buzz</h1>
        <p className="text-[var(--text-secondary)] text-sm">Testing Client</p>
      </div>

      <ul className="space-y-1 px-4 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)] text-white font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="absolute bottom-4 left-4 right-4 border-t border-[var(--border-color)] pt-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Theme</span>
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}
