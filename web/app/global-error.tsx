'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Critical root error caught by GlobalError:', error);
  }, [error]);

  return (
    <html lang="bn" className="dark">
      <body className="min-h-screen bg-[#050608] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl p-6 sm:p-8 text-center space-y-5 border border-rose-500/30 bg-[#090A0F] shadow-2xl">
          <div className="h-16 w-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে
            </h2>
            <p className="text-sm text-slate-300">
              System recovery mode — reload to restore state.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 border border-indigo-500/50 text-indigo-200 font-semibold text-sm transition-all shadow-[0_0_15px_rgba(99,102,241,0.25)]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>পৃষ্ঠাটি পুনরায় লোড করুন (Reload)</span>
          </button>
        </div>
      </body>
    </html>
  );
}
