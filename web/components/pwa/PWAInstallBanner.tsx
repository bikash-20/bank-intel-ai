'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useI18n } from '../../lib/i18n/context';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'bank_intel_pwa_dismiss_v1';
const DISMISS_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

export const PWAInstallBanner: React.FC = () => {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. If running standalone (already installed), never show banner
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check if user dismissed recently
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

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 4. Capture BeforeInstallPromptEvent (Chromium / Android / Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If on iOS and not standalone, show after a short gentle delay (2 seconds)
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
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
      // Ignore localStorage write error
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="PWA Installation Banner"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
      >
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-obsidian-900/95 p-4 sm:p-5 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.15)] ring-1 ring-white/10">
          {/* Subtle green ambient accent glow */}
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-28 w-28 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

          <div className="flex items-start gap-3.5 sm:gap-4">
            {/* App Icon (SVG / PNG) */}
            <div className="relative h-13 w-13 sm:h-14 sm:w-14 shrink-0 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-md bg-[#F3FBF6] p-1 flex items-center justify-center">
              {/* Fallback to img to ensure zero-config SVG & PNG rendering */}
              <img
                src="/bankintel-pwa.svg"
                alt="BankIntel App Icon"
                width={52}
                height={52}
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', '/pwa-192x192.png');
                }}
              />
            </div>

            {/* Text & Value Proposition */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="h-2.5 w-2.5" />
                  PWA
                </span>
                <span className={`text-sm sm:text-base font-bold text-white tracking-tight ${isBn ? 'font-bengali font-bold' : ''}`}>
                  {t.install.bannerTitle}
                </span>
              </div>

              <p className={`text-xs text-slate-300 leading-snug line-clamp-2 ${isBn ? 'font-bengali text-sm' : ''}`}>
                {t.install.bannerDesc}
              </p>

              {/* iOS Manual Instructions */}
              {isIOS && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300/90 font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl">
                  <Share className="h-3.5 w-3.5 shrink-0" />
                  <span className={isBn ? 'font-bengali' : ''}>
                    {t.install.iosTip}
                  </span>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action Row */}
          {!isIOS && (
            <div className="mt-3.5 flex items-center gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleInstallClick}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-[#075B3B] hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] ${
                  isBn ? 'font-bengali text-base' : ''
                }`}
              >
                <Download className="h-4 w-4" />
                <span>{t.install.installBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className={`py-2 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs sm:text-sm font-medium transition-colors ${
                  isBn ? 'font-bengali' : ''
                }`}
              >
                {t.install.dismiss}
              </button>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

