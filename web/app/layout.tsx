import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono, Newsreader, Hind_Siliguri } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '../lib/i18n/context';
import { HeaderNav } from '../components/layout/HeaderNav';
import { MobileBottomNav } from '../components/layout/MobileBottomNav';
import { PWAInstallBanner } from '../components/pwa/PWAInstallBanner';

const sansFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const displayFont = Newsreader({
  subsets: ['latin'],
  style: ['italic', 'normal'],
  variable: '--font-display',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const bengaliFont = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BankIntel — Bangladesh Bank & BSC MCQ Intelligence Platform',
  description:
    'Ultra-fast, mobile-first offline PWA with -0.25 negative marking engine and on-demand Per-Option AI distractor explanations in English & Bengali.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/bankintel-pwa.svg', type: 'image/svg+xml' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BankIntel',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#075B3B',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${sansFont.variable} ${displayFont.variable} ${monoFont.variable} ${bengaliFont.variable}`}
    >
      <body className="min-h-screen bg-obsidian-950 font-sans text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200 pb-20 sm:pb-8">
        <I18nProvider>
          {/* Subtle background glow */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] sm:w-[1000px] h-[300px] sm:h-[400px] bg-indigo-600/5 blur-[120px] rounded-full" />
          </div>

          {/* Desktop/Tablet Header Nav */}
          <HeaderNav />

          {/* Main View Area */}
          <main className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-8">
            {children}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <MobileBottomNav />

          {/* PWA Install Banner */}
          <PWAInstallBanner />

          {/* PWA Service Worker Registration */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function(err) {
                      console.log('SW registration error:', err);
                    });
                  });
                }
              `,
            }}
          />
        </I18nProvider>
      </body>
    </html>
  );
}
