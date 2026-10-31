'use client';

import { useSyncExternalStore } from 'react';
import type { BootSummary } from '../types';

const STORAGE_KEY = 'boot_summary_v1';

const DEFAULT_BOOT_SUMMARY: BootSummary = {
  theme: 'dark',
  lastShardId: 'bb-ad-2026',
  totalAttempts: 0,
  correctAttempts: 0,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
};

let currentCachedSummary: BootSummary = DEFAULT_BOOT_SUMMARY;
let lastRawSummaryString: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): BootSummary {
  if (typeof window === 'undefined') {
    return DEFAULT_BOOT_SUMMARY;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (lastRawSummaryString !== null) {
        lastRawSummaryString = null;
        currentCachedSummary = DEFAULT_BOOT_SUMMARY;
      }
      return currentCachedSummary;
    }
    if (raw !== lastRawSummaryString) {
      lastRawSummaryString = raw;
      const parsed = JSON.parse(raw);
      currentCachedSummary = { ...DEFAULT_BOOT_SUMMARY, ...parsed };
    }
    return currentCachedSummary;
  } catch {
    return currentCachedSummary;
  }
}

function getServerSnapshot(): BootSummary {
  return DEFAULT_BOOT_SUMMARY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}

export function useBootSummary(): BootSummary {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updateBootSummary(patch: Partial<BootSummary>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSnapshot();
    const updated: BootSummary = { ...current, ...patch };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    currentCachedSummary = updated;
    notify();
  } catch (err: any) {
    console.error('Failed to update boot summary in localStorage:', err?.message);
  }
}
