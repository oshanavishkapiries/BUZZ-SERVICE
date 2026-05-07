'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/stream', label: 'Live Stream', icon: '📡' },
  { href: '/inbox', label: 'Inbox', icon: '📬' },
  { href: '/templates', label: 'Templates', icon: '📋' },
  { href: '/devices', label: 'Devices', icon: '📱' },
  { href: '/batches', label: 'Batches', icon: '📦' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-gray-900 text-white h-screen overflow-y-auto fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Buzz</h1>
        <p className="text-gray-400 text-sm">Testing Client</p>
      </div>
      <ul className="space-y-1 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
