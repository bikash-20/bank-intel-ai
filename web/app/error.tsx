'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div
        className="max-w-md w-full filter-panel-rounded p-6 sm:p-8 text-center space-y-5 border shadow-xl"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center mx-auto shadow-sm"
          style={{
            backgroundColor: 'var(--badbg)',
            color: 'var(--bad)',
            border: '1px solid var(--bad)',
          }}
        >
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div className="space-y-1.5">
          <h2
            className="text-xl sm:text-2xl font-serif-app font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে
          </h2>
          <p
            className="text-sm font-sans-app"
            style={{ color: 'var(--mute)' }}
          >
            An unexpected error occurred during rendering.
          </p>
        </div>

        {error.message && (
          <div
            className="rounded-2xl p-3 text-xs text-left max-h-24 overflow-y-auto border"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--bad)',
            }}
          >
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full font-semibold text-sm transition-all active:scale-95 shadow-sm"
            style={{
              backgroundColor: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span>পুনরায় চেষ্টা করুন (Retry)</span>
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full border text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            <Home className="h-4 w-4" />
            <span>হোমে ফিরুন (Home)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
