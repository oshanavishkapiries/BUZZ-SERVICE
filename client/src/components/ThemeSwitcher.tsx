'use client';

import { useEffect, useState } from 'react';

export function ThemeSwitcher() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage or system preference
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved === 'dark' || (saved === null && prefersDark);
    setIsDark(shouldBeDark);
    updateTheme(shouldBeDark);
  }, []);

  const updateTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggle = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    updateTheme(newValue);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      className="p-2 rounded border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] transition-colors"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l-2.12-2.12a4 4 0 00 5.656-5.656l2.12 2.12a6 6 0 01-5.656 5.656zm2.12-10.606a6 6 0 010 8.485l-2.12-2.121a4 4 0 005.656-5.656l-2.121 2.121zM5.678 4.678a6 6 0 00 0 8.485l-2.12-2.12a4 4 0 015.656-5.656l-2.12 2.12zm0 10.606a6 6 0 010-8.485l2.12 2.121a4 4 0 00-5.656 5.656l2.12-2.121z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}
