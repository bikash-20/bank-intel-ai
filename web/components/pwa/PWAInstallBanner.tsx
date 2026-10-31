'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share } from 'lucide-react';
import { useI18n } from '../../lib/i18n/context';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'bi_pwa_dismiss_v2';
const DISMISS_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

export const PWAInstallBanner: React.FC = () => {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    try {
      const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timeSince = Date.now() - parseInt(dismissedAt, 10);
        if (timeSince < DISMISS_DURATION_MS) {
          return;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setInstallPrompt(null);
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // Ignore
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="PWA Installation Banner"
        initial={{ opacity: 0, y: 50, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
      >
        <div
          className="relative overflow-hidden rounded-[32px] border p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="flex items-start gap-3.5 sm:gap-4">
            {/* Logo Mark */}
            <div
              className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: 'var(--brand)',
                color: 'var(--brand-ink)',
              }}
            >
              <span className="font-serif-app text-2xl font-semibold leading-none select-none">
                ব
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="font-serif-app font-semibold text-base sm:text-lg"
                  style={{ color: 'var(--ink)' }}
                >
                  {isBn ? 'ব্যাংক-ইনটেল ইনস্টল করুন' : 'Install Bank-Intel'}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-sans-app font-medium border"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    color: 'var(--brand)',
                    borderColor: 'var(--line)',
                  }}
                >
                  PWA
                </span>
              </div>

              <p
                className="text-xs sm:text-[13px] font-sans-app leading-snug line-clamp-2"
                style={{ color: 'var(--mute)' }}
              >
                {isBn
                  ? 'অফলাইনে তাৎক্ষণিক এমসিকিউ অনুশীলন ও দ্রুততম লোডিংয়ের জন্য অ্যাপ হিসেবে ইনস্টল করুন।'
                  : 'Install as an app for instantaneous offline practice and real edge AI explanations.'}
              </p>

              {/* iOS Safari Tip */}
              {isIOS && (
                <div
                  className="mt-2.5 flex items-center gap-2 text-xs font-sans-app p-2.5 rounded-2xl border"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                  }}
                >
                  <Share className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                  <span>
                    {isBn
                      ? 'সাফারির Share আইকন চেপে "Add to Home Screen" নির্বাচন করুন।'
                      : 'Tap Safari Share icon and select "Add to Home Screen".'}
                  </span>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-full transition-colors"
              style={{
                color: 'var(--mute)',
              }}
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action Row */}
          {!isIOS && (
            <div
              className="mt-4 flex items-center gap-2 pt-3 border-t"
              style={{ borderColor: 'var(--line)' }}
            >
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full font-semibold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                <Download className="h-4 w-4" />
                <span>{isBn ? 'ইনস্টল করুন' : 'Install App'}</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="py-2.5 px-4 rounded-full border text-xs sm:text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--surface2)',
                  borderColor: 'var(--line)',
                  color: 'var(--mute)',
                }}
              >
                {isBn ? 'পরে' : 'Later'}
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
