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
      <div className="max-w-md w-full glass-panel rounded-3xl p-6 sm:p-8 text-center space-y-5 border border-rose-500/30 bg-rose-950/20 shadow-2xl">
        <div className="h-16 w-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-[0_0_20px_rgba(244,63,94,0.25)]">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-bengali">
            পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে
          </h2>
          <p className="text-sm text-slate-300">
            An unexpected error occurred during rendering.
          </p>
        </div>

        {error.message && (
          <div className="rounded-xl bg-black/40 border border-white/5 p-3 text-xs font-mono text-rose-300/80 max-h-24 overflow-y-auto text-left">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-500/40 text-indigo-200 font-semibold text-sm transition-all active:scale-95 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="font-bengali text-base">পুনরায় চেষ্টা করুন (Retry)</span>
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium text-sm transition-all"
          >
            <Home className="h-4 w-4" />
            <span className="font-bengali text-base">হোমে ফিরুন (Home)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
