'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Timer, AlertOctagon, PenLine } from 'lucide-react';
import { useI18n } from '../../lib/i18n/context';

export const DesktopNav: React.FC = () => {
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
      label: isBn ? 'ভুল ব্যাংক' : 'Mistake bank',
      icon: AlertOctagon,
      isActive: pathname.startsWith('/vault'),
    },
    {
      href: '/writing',
      label: isBn ? 'লিখিত প্রস্তুতি' : 'Writing',
      icon: PenLine,
      isActive: pathname.startsWith('/writing'),
    },
  ];

  return (
    <nav className="hidden md:flex items-center gap-2.5 pt-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.isActive;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] transition-all duration-200 border"
            style={{
              backgroundColor: active ? 'var(--pill)' : 'var(--surface)',
              color: active ? 'var(--pill-ink)' : 'var(--ink)',
              borderColor: active ? 'transparent' : 'var(--line)',
              fontWeight: active ? 600 : 500,
            }}
          >
            <Icon className="h-4 w-4" />
            <span className="font-sans-app">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
