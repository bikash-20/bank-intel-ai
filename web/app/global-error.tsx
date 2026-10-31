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
    <html lang="bn">
      <body
        className="min-h-screen flex items-center justify-center p-4 font-sans"
        style={{
          backgroundColor: '#fdfbfa',
          color: '#2a1a20',
        }}
      >
        <div
          className="max-w-md w-full rounded-[36px] p-6 sm:p-8 text-center space-y-5 border shadow-xl"
          style={{
            backgroundColor: '#ffffff',
            borderColor: '#efe3e5',
            boxShadow: '0 18px 50px -24px rgba(155,34,67,.35)',
          }}
        >
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto"
            style={{
              backgroundColor: '#fbe8eb',
              color: '#b3243b',
              border: '1px solid #b3243b',
            }}
          >
            <AlertTriangle className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h2
              className="text-xl sm:text-2xl font-bold"
              style={{ color: '#2a1a20' }}
            >
              পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে
            </h2>
            <p
              className="text-sm"
              style={{ color: '#8a7479' }}
            >
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
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-full font-semibold text-sm transition-all shadow-sm"
            style={{
              backgroundColor: '#9b2243',
              color: '#ffffff',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span>পুনরায় লোড করুন (Reload)</span>
          </button>
        </div>
      </body>
    </html>
  );
}
