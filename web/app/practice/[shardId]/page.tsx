'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { QuestionCard } from '../../../components/mcq/QuestionCard';
import { bulkWriteQuestions } from '../../../lib/db/idb';
import { useI18n } from '../../../lib/i18n/context';
import type { QuestionItem, ShardManifest } from '../../../lib/types';

function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)] ?? d);
}

export default function PracticeShardPage() {
  const params = useParams();
  const shardId = params.shardId as string;
  const router = useRouter();
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shardTitle, setShardTitle] = useState(shardId);
  const [isLoading, setIsLoading] = useState(true);

  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  useEffect(() => {
    async function loadShard() {
      setIsLoading(true);
      try {
        const manifestRes = await fetch('/shards/manifest.json');
        const manifest: ShardManifest = await manifestRes.json();
        const meta = manifest.shards.find((s) => s.id === shardId);
        if (meta) {
          setShardTitle(meta.title);
          const shardRes = await fetch(`/shards/${meta.fileName}`);
          const shardData: QuestionItem[] = await shardRes.json();
          setQuestions(shardData);
          try {
            await bulkWriteQuestions(shardData);
          } catch (e) {
            console.warn('IDB write error:', e);
          }
        } else {
          router.replace('/');
        }
      } catch (err: any) {
        console.error('Failed to load shard:', err?.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (shardId) loadShard();
  }, [shardId, router]);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center animate-pulse border border-white/10">
        <div className="h-6 w-48 rounded bg-white/10 mx-auto mb-4" />
        <div className="h-4 w-64 rounded bg-white/10 mx-auto" />
      </div>
    );
  }

  const activeQuestion = questions[currentIndex];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/10">
        <Link
          href="/"
          className={`flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white active:scale-95 transition-all ${
            isBn ? 'font-bengali' : 'font-mono'
          }`}
        >
          <ArrowLeft className="h-4 w-4 text-indigo-400" />
          <span>{isBn ? '← মূল ড্যাশবোর্ডে ফিরুন' : '← Back to Matrix'}</span>
        </Link>

        <div className="flex items-center gap-2 font-mono text-xs sm:text-sm text-indigo-300 font-bold truncate max-w-[200px] sm:max-w-none">
          <BookOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{shardTitle}</span>
        </div>

        <div
          className={`text-xs sm:text-sm text-slate-400 tabular-nums font-semibold ${
            isBn ? 'font-bengali' : 'font-mono'
          }`}
        >
          {num(currentIndex + 1)} / {num(questions.length)}
        </div>
      </div>

      {activeQuestion && (
        <QuestionCard
          key={activeQuestion.id}
          question={activeQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          mode="PRACTICE"
          onNext={
            currentIndex < questions.length - 1
              ? () => setCurrentIndex((i) => i + 1)
              : undefined
          }
        />
      )}
    </div>
  );
}
