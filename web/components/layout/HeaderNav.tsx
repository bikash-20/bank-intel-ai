'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Compass, Timer, AlertOctagon, Languages } from 'lucide-react';
import { useI18n } from '../../lib/i18n/context';

export const HeaderNav: React.FC = () => {
  const { t, locale, toggleLocale } = useI18n();
  const pathname = usePathname();

  const isBn = locale === 'bn';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-obsidian-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 h-16">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(99,102,241,0.2)]">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex flex-col">
            <span
              className={`text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5 ${
                isBn ? 'font-bengali font-bold' : 'font-display italic'
              }`}
            >
              {t.appName}
              <span className="text-[10px] not-italic font-mono font-normal uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {t.appBadge}
              </span>
            </span>
            <span
              className={`text-[11px] text-slate-400 -mt-1 hidden sm:inline-block ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.appSubtitle}
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                pathname === '/'
                  ? 'bg-white/10 text-white border border-white/15 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              } ${isBn ? 'font-bengali text-base' : ''}`}
            >
              <Compass className="h-4 w-4 text-indigo-400" />
              <span>{t.nav.practice}</span>
            </Link>

            <Link
              href="/simulate"
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                pathname.startsWith('/simulate')
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              } ${isBn ? 'font-bengali text-base' : ''}`}
            >
              <Timer className="h-4 w-4 text-emerald-400" />
              <span>{t.nav.simulator}</span>
            </Link>

            <Link
              href="/vault"
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                pathname.startsWith('/vault')
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              } ${isBn ? 'font-bengali text-base' : ''}`}
            >
              <AlertOctagon className="h-4 w-4 text-rose-400" />
              <span>{t.nav.vault}</span>
            </Link>
          </nav>

          {/* Language Toggle Button */}
          <button
            type="button"
            onClick={toggleLocale}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-medium text-xs sm:text-sm transition-all active:scale-95 shadow-[0_0_10px_rgba(99,102,241,0.15)]"
            title={locale === 'en' ? 'বাংলা ভাষায় পরিবর্তন করুন' : 'Switch to English'}
          >
            <Languages className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="font-semibold">{t.nav.langToggle}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
