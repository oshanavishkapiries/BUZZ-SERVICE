import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { HealthStatus } from '@/components/HealthStatus';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buzz — Service Client',
  description: 'Developer testing client for the Buzz Notification Service',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                const d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && d)) document.documentElement.classList.add('dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased min-h-screen">
        <Sidebar />
        <HealthStatus />
        <div className="ml-56 min-h-screen flex flex-col">
          <main className="flex-1 p-8 max-w-6xl">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
