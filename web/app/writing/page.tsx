'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DesktopNav } from '../../components/layout/DesktopNav';
import { useI18n } from '../../lib/i18n/context';
import {
  loadWritingIndex,
  loadWritingShard,
  type WritingExamIndexItem,
  type WritingShard,
} from '../../lib/writing';
import { BookOpen, Loader2 } from 'lucide-react';

// Lazy-load the WritingWorkspace to avoid bundling heavy Markdown/KaTeX in initial MCQ path
const DynamicWritingWorkspace = dynamic(
  () =>
    import('../../components/writing/WritingWorkspace').then(
      (mod) => mod.WritingWorkspace
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-[28px] sm:rounded-[36px] border p-12 text-center animate-pulse flex flex-col items-center justify-center space-y-3"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
        <p className="text-sm font-sans-app text-[var(--mute)]">
          Loading written examination workspace...
        </p>
      </div>
    ),
  }
);

export default function WritingPage() {
  const { locale } = useI18n();
  const isBn = locale === 'bn';

  const [indexList, setIndexList] = useState<WritingExamIndexItem[]>([]);
  const [selectedShardId, setSelectedShardId] = useState<string>('');
  const [currentShard, setCurrentShard] = useState<WritingShard | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(true);
  const [isLoadingShard, setIsLoadingShard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load Writing Index
  useEffect(() => {
    async function initIndex() {
      setIsLoadingIndex(true);
      setError(null);
      try {
        const list = await loadWritingIndex();
        setIndexList(list);
        if (list.length > 0) {
          setSelectedShardId(list[0].shardId);
        }
      } catch (err: any) {
        console.error('Failed to load writing index:', err);
        setError(
          isBn
            ? 'লিখিত পরীক্ষার ইনডেক্স লোড করা সম্ভব হয়নি।'
            : 'Failed to load written exam index.'
        );
      } finally {
        setIsLoadingIndex(false);
      }
    }

    initIndex();
  }, [isBn]);

  // 2. Load Selected Shard Questions
  useEffect(() => {
    if (!selectedShardId) return;

    async function fetchShard() {
      setIsLoadingShard(true);
      setError(null);
      try {
        const item = indexList.find((i) => i.shardId === selectedShardId);
        const fileTarget = item ? item.file : selectedShardId;
        const shardData = await loadWritingShard(fileTarget);
        setCurrentShard(shardData);
      } catch (err: any) {
        console.error(`Failed to load shard ${selectedShardId}:`, err);
        setError(
          isBn
            ? 'লিখিত প্রশ্ন লোড করা সম্ভব হয়নি।'
            : 'Failed to load written questions for this exam.'
        );
      } finally {
        setIsLoadingShard(false);
      }
    }

    fetchShard();
  }, [selectedShardId, indexList, isBn]);

  return (
    <div className="space-y-6">
      {/* Top Desktop Navigation Row */}
      <DesktopNav />

      {/* Exam Shard Selector (Horizontal scrolling pill row on mobile) */}
      <section
        className="rounded-[28px] sm:rounded-[36px] border p-4 sm:p-5 transition-colors shadow-sm select-none"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--brand)]" />
            <span className="text-xs sm:text-[13px] font-semibold text-[var(--ink)]">
              {isBn ? 'লিখিত পরীক্ষার তালিকা' : 'Written Exam Papers'}
            </span>
          </div>

          {/* Horizontally Scrollable Exam Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {isLoadingIndex ? (
              <div className="h-8 w-40 rounded-full bg-[var(--surface2)] animate-pulse" />
            ) : (
              indexList.map((item) => {
                const isSelected = item.shardId === selectedShardId;
                return (
                  <button
                    key={item.shardId}
                    type="button"
                    onClick={() => setSelectedShardId(item.shardId)}
                    className="shrink-0 px-4 py-2 rounded-full text-xs sm:text-[13px] transition-all duration-200 border"
                    style={{
                      backgroundColor: isSelected ? 'var(--pill)' : 'var(--surface2)',
                      color: isSelected ? 'var(--pill-ink)' : 'var(--ink)',
                      borderColor: isSelected ? 'transparent' : 'var(--line)',
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {item.title}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Main Content Workspace */}
      {error ? (
        <div
          className="rounded-[28px] sm:rounded-[36px] border p-8 text-center text-sm font-medium"
          style={{
            backgroundColor: 'var(--badbg)',
            borderColor: 'var(--bad)',
            color: 'var(--bad)',
          }}
        >
          {error}
        </div>
      ) : isLoadingShard || !currentShard ? (
        <div
          className="rounded-[28px] sm:rounded-[36px] border p-12 text-center animate-pulse flex flex-col items-center justify-center space-y-3"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
          <p className="text-sm font-sans-app text-[var(--mute)]">
            {isBn ? 'লিখিত প্রশ্ন লোড হচ্ছে...' : 'Loading written questions...'}
          </p>
        </div>
      ) : (
        <DynamicWritingWorkspace
          questions={currentShard.questions}
          examTitle={currentShard.title}
          examPost={currentShard.post}
          workerUrl={
            process.env.NEXT_PUBLIC_WORKER_URL ||
            'https://bank-intel-worker.talukderbikash500.workers.dev'
          }
        />
      )}
    </div>
  );
}

