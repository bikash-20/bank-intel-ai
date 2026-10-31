'use client';

import React from 'react';
import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';
import { useI18n } from '../../lib/i18n/context';
import { useTheme } from '../../lib/theme/context';

export const HeaderNav: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const isBn = locale === 'bn';
  const isDark = theme === 'dark';

  return (
    <header className="w-full flex items-center justify-between gap-4 py-2">
      {/* Left: Brand Identity */}
      <Link href="/" className="flex items-center gap-3.5 group">
        {/* 44px Round Logo Mark in --brand with Bengali letter "ব" in serif */}
        <div
          className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: 'var(--brand)',
            color: 'var(--brand-ink)',
          }}
        >
          <span className="font-serif-app text-[26px] font-semibold leading-none select-none">
            ব
          </span>
        </div>

        {/* App Name and Muted Subtitle */}
        <div className="flex flex-col">
          <span className="app-title font-serif-app">
            {isBn ? 'ব্যাংক-ইনটেল' : 'Bank-Intel'}
          </span>
          <span
            className="text-[13px] leading-tight font-sans-app"
            style={{ color: 'var(--mute)' }}
          >
            {isBn
              ? 'বাংলাদেশ ব্যাংক ও বিসিএস প্রস্তুতি'
              : 'Bangladesh Bank & BCS Preparation'}
          </span>
        </div>
      </Link>

      {/* Right: Language Switch & Theme Toggle */}
      <div className="flex items-center gap-3">
        {/* Language Switch: Pill container with 4px padding, --surface2 bg, --line border */}
        <div
          className="hidden md:flex items-center p-1 rounded-full border transition-colors"
          style={{
            backgroundColor: 'var(--surface2)',
            borderColor: 'var(--line)',
          }}
        >
          <button
            type="button"
            onClick={() => setLocale('bn')}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200"
            style={{
              backgroundColor: isBn ? 'var(--pill)' : 'transparent',
              color: isBn ? 'var(--pill-ink)' : 'var(--mute)',
              fontWeight: isBn ? 600 : 500,
            }}
          >
            বাংলা
          </button>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200"
            style={{
              backgroundColor: !isBn ? 'var(--pill)' : 'transparent',
              color: !isBn ? 'var(--pill-ink)' : 'var(--mute)',
              fontWeight: !isBn ? 600 : 500,
            }}
          >
            English
          </button>
        </div>

        {/* Theme Toggle: 76x40px pill, --surface2 bg, 1px --line border, 32px knob sliding 36px */}
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label="Toggle day and night mode"
          onClick={toggleTheme}
          className="relative w-[76px] h-10 rounded-full border p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            backgroundColor: 'var(--surface2)',
            borderColor: 'var(--line)',
          }}
        >
          {/* Track Icons: Sun on left, Moon on right in --mute */}
          <div className="absolute inset-0 px-3 flex items-center justify-between pointer-events-none">
            <Sun
              className="h-4 w-4 transition-opacity duration-200"
              style={{
                color: 'var(--mute)',
                opacity: isDark ? 0.45 : 0.85,
              }}
            />
            <Moon
              className="h-4 w-4 transition-opacity duration-200"
              style={{
                color: 'var(--mute)',
                opacity: isDark ? 0.85 : 0.45,
              }}
            />
          </div>

          {/* 32px Round Knob in --pill / --pill-ink sliding 36px right */}
          <div
            className="absolute top-[3px] left-[3px] h-8 w-8 rounded-full flex items-center justify-center shadow-md"
            style={{
              backgroundColor: 'var(--pill)',
              color: 'var(--pill-ink)',
              transform: isDark ? 'translateX(36px)' : 'translateX(0px)',
              transition: 'transform 0.35s cubic-bezier(0.5, 1.6, 0.5, 1)',
            }}
          >
            {isDark ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <Sun className="h-3.5 w-3.5" />
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
