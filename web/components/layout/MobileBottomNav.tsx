'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Timer, AlertOctagon, Languages } from 'lucide-react';
import { useI18n } from '../../lib/i18n/context';

export const MobileBottomNav: React.FC = () => {
  const { t, locale, toggleLocale } = useI18n();
  const pathname = usePathname();
  const isBn = locale === 'bn';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/10 bg-obsidian-950/95 backdrop-blur-2xl px-2 py-1.5 safe-bottom">
      <div className="grid grid-cols-4 gap-1">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            pathname === '/'
              ? 'bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="h-5 w-5 mb-0.5" />
          <span className={`text-[11px] leading-tight ${isBn ? 'font-bengali' : ''}`}>
            {t.nav.practice}
          </span>
        </Link>

        <Link
          href="/simulate"
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            pathname.startsWith('/simulate')
              ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Timer className="h-5 w-5 mb-0.5" />
          <span className={`text-[11px] leading-tight ${isBn ? 'font-bengali' : ''}`}>
            {t.nav.simulator}
          </span>
        </Link>

        <Link
          href="/vault"
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
            pathname.startsWith('/vault')
              ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertOctagon className="h-5 w-5 mb-0.5" />
          <span className={`text-[11px] leading-tight ${isBn ? 'font-bengali' : ''}`}>
            {t.nav.vault}
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleLocale}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-slate-300 hover:bg-white/5 active:scale-95 transition-all"
        >
          <Languages className="h-5 w-5 mb-0.5 text-indigo-400" />
          <span className="text-[11px] font-bold text-indigo-300 leading-tight">
            {t.nav.langToggle}
          </span>
        </button>
      </div>
    </div>
  );
};
