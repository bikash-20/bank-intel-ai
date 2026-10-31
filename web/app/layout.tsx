import type { Metadata, Viewport } from 'next';
import { Fraunces, Noto_Serif_Bengali, Inter, Hind_Siliguri } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../lib/theme/context';
import { I18nProvider } from '../lib/i18n/context';
import { HeaderNav } from '../components/layout/HeaderNav';
import { MobileBottomNav } from '../components/layout/MobileBottomNav';
import { PWAInstallBanner } from '../components/pwa/PWAInstallBanner';
import { Petals } from '../components/decor/Petals';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ['bengali'],
  weight: ['500', '700'],
  variable: '--font-noto-serif-bengali',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-hind-siliguri',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bank-Intel — Bangladesh Bank & BCS MCQ Intelligence Platform',
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
    statusBarStyle: 'default',
    title: 'Bank-Intel',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#9b2243',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${notoSerifBengali.variable} ${inter.variable} ${hindSiliguri.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Zero-CLS / Zero-Flicker Theme & Language Init */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('bi-theme');
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.style.colorScheme = theme;

                var lang = localStorage.getItem('bank_intel_locale_v1') || 'en';
                document.documentElement.setAttribute('lang', lang);
                document.documentElement.setAttribute('data-lang', lang);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-[#ffd3df] selection:text-[#2a1a20]">
        <ThemeProvider>
          <I18nProvider>
            {/* Background Falling Petals Signature Layer */}
            <Petals />

            {/* Application Main Layout Wrapper (Centered Max Width 1040px, Padding 18px 20px 110px) */}
            <div className="relative z-10 mx-auto max-w-[1040px] px-4 sm:px-5 pt-[18px] pb-[110px] space-y-6">
              {/* Header */}
              <HeaderNav />

              {/* Page Content */}
              <main className="w-full">
                {children}
              </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />

            {/* PWA Installation Prompt Banner */}
            <PWAInstallBanner />

            {/* PWA Service Worker Registration with Immediate Update Check */}
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js').then(function(reg) {
                        reg.update();
                      }).catch(function(err) {
                        console.log('SW registration error:', err);
                      });
                    });
                  }
                `,
              }}
            />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
