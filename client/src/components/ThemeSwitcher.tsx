'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeSwitcher() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (saved === null && prefersDark);
    setIsDark(dark);
    applyTheme(dark);
  }, []);

  const applyTheme = (dark: boolean) => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  };

  if (!mounted) return <div className="w-7 h-7" />;

  return (
    <button
      onClick={() => { setIsDark(v => { applyTheme(!v); return !v; }); }}
      className="flex items-center justify-center w-7 h-7 rounded-[var(--radius)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  );
}
