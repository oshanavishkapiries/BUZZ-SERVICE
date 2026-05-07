import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { HealthStatus } from "@/components/HealthStatus";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buzz Testing Client",
  description: "Visual testing client for Buzz Notification Service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (theme === null && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
        <Sidebar />
        <main className="ml-64 p-8">
          <HealthStatus />
          {children}
        </main>
      </body>
    </html>
  );
}
