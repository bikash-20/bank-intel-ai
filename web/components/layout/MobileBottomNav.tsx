'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Timer, AlertOctagon, PenLine } from 'lucide-react';
import { useI18n } from '../../lib/i18n/context';

export const MobileBottomNav: React.FC = () => {
  const { locale } = useI18n();
  const pathname = usePathname();
  const isBn = locale === 'bn';

  const navItems = [
    {
      href: '/',
      label: isBn ? 'অনুশীলন' : 'Practice',
      icon: Compass,
      isActive: pathname === '/',
    },
    {
      href: '/simulate',
      label: isBn ? 'সিমুলেটর' : 'Simulator',
      icon: Timer,
      isActive: pathname.startsWith('/simulate'),
    },
    {
      href: '/vault',
      label: isBn ? 'ভুল ব্যাংক' : 'Mistakes',
      icon: AlertOctagon,
      isActive: pathname.startsWith('/vault'),
    },
    {
      href: '/writing',
      label: isBn ? 'লিখিত' : 'Writing',
      icon: PenLine,
      isActive: pathname.startsWith('/writing'),
    },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t px-3 py-2 safe-bottom transition-colors"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div className="grid grid-cols-4 gap-1.5 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-200"
              style={{
                backgroundColor: active ? 'var(--pill)' : 'transparent',
                color: active ? 'var(--pill-ink)' : 'var(--mute)',
              }}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              <span className="text-[11px] font-sans-app font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
