'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useBootSummary, updateBootSummary } from '../lib/db/sync-store';
import {
  bulkWriteQuestions,
  getAllQuestionsFromIDB,
  getMeta,
  setMeta,
} from '../lib/db/idb';
import {
  buildBitmaskIndex,
  queryBitmaskIndex,
  type BitmaskIndex,
} from '../lib/search/bitmask-index';
import { QuestionCard } from '../components/mcq/QuestionCard';
import { DesktopNav } from '../components/layout/DesktopNav';
import { useI18n } from '../lib/i18n/context';
import type {
  QuestionItem,
  ShardManifest,
  SubjectCode,
  UserAttempt,
} from '../lib/types';

const SUBJECT_LIST: { code: SubjectCode; en: string; bn: string }[] = [
  { code: 'MATH', en: 'Math', bn: 'গণিত' },
  { code: 'ENGLISH', en: 'English', bn: 'ইংরেজি' },
  { code: 'ANALYTICAL', en: 'Mental ability', bn: 'মানসিক দক্ষতা' },
  { code: 'COMPUTER_ICT', en: 'Computer and ICT', bn: 'কম্পিউটার ও আইসিটি' },
  { code: 'GENERAL_KNOWLEDGE', en: 'General knowledge', bn: 'সাধারণ জ্ঞান' },
];

const SHARD_NAMES: Record<string, { en: string; bn: string }> = {
  'bb-ad-2026': {
    en: 'Bangladesh Bank Assistant Director 2026',
    bn: 'বাংলাদেশ ব্যাংক সহকারী পরিচালক ২০২৬',
  },
  'bb-so-it-2026': {
    en: 'Bangladesh Bank Senior Officer (IT) 2026',
    bn: 'বাংলাদেশ ব্যাংক সিনিয়র অফিসার (আইটি) ২০২৬',
  },
  'bb-cash-2023': {
    en: 'Bangladesh Bank Officer (Cash) 2023',
    bn: 'বাংলাদেশ ব্যাংক অফিসার (ক্যাশ) ২০২৩',
  },
};

function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)] ?? d);
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';
  const bootSummary = useBootSummary();

  const [manifest, setManifest] = useState<ShardManifest | null>(null);
  const [selectedShardId, setSelectedShardId] = useState<string>(
    bootSummary.lastShardId || 'bb-ad-2026'
  );
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>([]);
  const [bitmaskIndex, setBitmaskIndex] = useState<BitmaskIndex | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectCode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingShard, setIsLoadingShard] = useState(true);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState(0);
  const [, startTransition] = useTransition();

  // 1. Fetch manifest & hydrate active shard on mount
  useEffect(() => {
    let isCancelled = false;

    async function hydrate() {
      setIsLoadingShard(true);
      try {
        const manifestRes = await fetch('/shards/manifest.json');
        if (!manifestRes.ok) throw new Error('Failed to load manifest');
        const manifestData: ShardManifest = await manifestRes.json();
        if (isCancelled) return;
        setManifest(manifestData);

        const activeMeta =
          manifestData.shards.find((s) => s.id === selectedShardId) ||
          manifestData.shards[0];
        if (!activeMeta) return;

        let questions: QuestionItem[] = [];
        try {
          const cachedHash = await getMeta(`shard_version_${activeMeta.id}`);
          if (cachedHash === activeMeta.versionHash) {
            const idbQuestions = await getAllQuestionsFromIDB();
            questions = idbQuestions.filter((q) =>
              q.appearances?.some(
                (a) => a.year === activeMeta.year && a.post === activeMeta.post
              )
            );
          }
        } catch (idbErr) {
          console.warn('IDB lookup fallback to network fetch:', idbErr);
        }

        if (!questions || questions.length === 0) {
          const shardRes = await fetch(`/shards/${activeMeta.fileName}`);
          if (!shardRes.ok) throw new Error('Failed to fetch shard JSON');
          questions = await shardRes.json();
          try {
            await bulkWriteQuestions(questions);
            await setMeta(`shard_version_${activeMeta.id}`, activeMeta.versionHash);
          } catch (cacheErr) {
            console.warn('Could not cache to IDB:', cacheErr);
          }
        }

        if (isCancelled) return;
        setAllQuestions(questions);

        const index = buildBitmaskIndex(questions);
        setBitmaskIndex(index);
        setCurrentIndex(0);
      } catch (err: any) {
        console.error('Shard hydration error:', err?.message);
      } finally {
        if (!isCancelled) {
          setIsLoadingShard(false);
        }
      }
    }

    hydrate();

    return () => {
      isCancelled = true;
    };
  }, [selectedShardId]);

  // 2. Compute filtered question list via Bitmask Index
  const filteredQuestions = useMemo(() => {
    if (!bitmaskIndex || allQuestions.length === 0) return allQuestions;
    if (selectedSubjects.length === 0) return allQuestions;

    const matchedIndices = queryBitmaskIndex(bitmaskIndex, {
      subjects: selectedSubjects,
    });
    return matchedIndices.map((i) => allQuestions[i]).filter(Boolean);
  }, [bitmaskIndex, allQuestions, selectedSubjects]);

  const activeQuestion = filteredQuestions[currentIndex] || filteredQuestions[0];

  const handleShardChange = (shardId: string) => {
    setSelectedShardId(shardId);
    updateBootSummary({ lastShardId: shardId });
  };

  const toggleSubjectFilter = (code: SubjectCode) => {
    startTransition(() => {
      setSelectedSubjects((prev) =>
        prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
      );
      setCurrentIndex(0);
    });
  };

  const handleAnswerSelected = (attempt: UserAttempt) => {
    if (attempt.isCorrect) {
      setSessionCorrect((c) => c + 1);
      updateBootSummary({
        totalAttempts: bootSummary.totalAttempts + 1,
        correctAttempts: bootSummary.correctAttempts + 1,
      });
    } else {
      setSessionWrong((w) => w + 1);
      updateBootSummary({
        totalAttempts: bootSummary.totalAttempts + 1,
      });
    }
  };

  const netScore = sessionCorrect * 1.0 - sessionWrong * 0.25;
  const accuracy =
    sessionCorrect + sessionWrong > 0
      ? Math.round((sessionCorrect / (sessionCorrect + sessionWrong)) * 100)
      : 100;

  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 2. Desktop Nav Pills */}
      <DesktopNav />

      {/* 3. Four Stat Cards (4 cols on desktop/tablet, 2 cols on mobile) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Net score (-0.25), in --ok, formatted "+0.00" */}
        <div
          className="stat-card-rounded border p-3.5 sm:p-5 lg:p-6 transition-colors duration-300 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            className="text-xs sm:text-[14px] font-sans-app font-medium mb-1 truncate"
            style={{ color: 'var(--mute)' }}
          >
            {isBn ? 'নেট স্কোর (-০.২৫)' : 'Net score (-0.25)'}
          </div>
          <div
            className="stat-number"
            style={{ color: 'var(--ok)' }}
          >
            {netScore >= 0 ? `+${num(netScore.toFixed(2))}` : num(netScore.toFixed(2))}
          </div>
        </div>

        {/* Card 2: Accuracy, in --brand, "100%" */}
        <div
          className="stat-card-rounded border p-3.5 sm:p-5 lg:p-6 transition-colors duration-300 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            className="text-xs sm:text-[14px] font-sans-app font-medium mb-1 truncate"
            style={{ color: 'var(--mute)' }}
          >
            {isBn ? 'সঠিকতার হার' : 'Accuracy'}
          </div>
          <div
            className="stat-number"
            style={{ color: 'var(--brand)' }}
          >
            {num(accuracy)}%
          </div>
        </div>

        {/* Card 3: Penalty deducted, in --bad, "-0.00" */}
        <div
          className="stat-card-rounded border p-3.5 sm:p-5 lg:p-6 transition-colors duration-300 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            className="text-xs sm:text-[14px] font-sans-app font-medium mb-1 truncate"
            style={{ color: 'var(--mute)' }}
          >
            {isBn ? 'পেনাল্টি কর্তন' : 'Penalty deducted'}
          </div>
          <div
            className="stat-number"
            style={{ color: 'var(--bad)' }}
          >
            -{num((sessionWrong * 0.25).toFixed(2))}
          </div>
        </div>

        {/* Card 4: Streak, in --ink, "1 day" (the unit is 16px muted) */}
        <div
          className="stat-card-rounded border p-3.5 sm:p-5 lg:p-6 transition-colors duration-300 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            className="text-xs sm:text-[14px] font-sans-app font-medium mb-1 truncate"
            style={{ color: 'var(--mute)' }}
          >
            {isBn ? 'ধারাবাহিকতা' : 'Streak'}
          </div>
          <div
            className="stat-number flex items-baseline gap-1.5"
            style={{ color: 'var(--ink)' }}
          >
            <span>{num(bootSummary.streakDays || 1)}</span>
            <span
              className="text-xs sm:text-[15px] font-sans-app font-normal"
              style={{ color: 'var(--mute)' }}
            >
              {isBn ? 'দিন' : 'day'}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Filter Panel (Single-line horizontal scroll on mobile, wraps on desktop) */}
      <section
        className="filter-panel-rounded border p-3.5 sm:p-5 lg:p-6 transition-colors duration-300"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
        }}
      >
        {/* Row 1: Question Bank chips */}
        <div className="space-y-2.5">
          <div
            className="text-xs sm:text-[15px] font-sans-app font-semibold select-none"
            style={{ color: 'var(--ink)' }}
          >
            {isBn ? 'পরীক্ষার প্রশ্নব্যাংক' : 'Question bank'}
          </div>
          <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar py-0.5 snap-x">
            {(manifest?.shards || [
              { id: 'bb-ad-2026' },
              { id: 'bb-so-it-2026' },
              { id: 'bb-cash-2023' },
            ]).map((s) => {
              const isSelected = selectedShardId === s.id;
              const label =
                SHARD_NAMES[s.id]?.[isBn ? 'bn' : 'en'] || s.id;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleShardChange(s.id)}
                  className="shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-[14px] font-sans-app transition-all duration-200 border"
                  style={{
                    backgroundColor: isSelected ? 'var(--pill)' : 'var(--surface)',
                    color: isSelected ? 'var(--pill-ink)' : 'var(--ink)',
                    borderColor: isSelected ? 'transparent' : 'var(--line)',
                    fontWeight: isSelected ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--brand)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'var(--line)';
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1px divider */}
        <div
          className="my-3.5 sm:my-5 border-b"
          style={{ borderColor: 'var(--line)' }}
        />

        {/* Row 2: Filter by subject chips + question count */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div
                className="text-xs sm:text-[15px] font-sans-app font-semibold select-none"
                style={{ color: 'var(--ink)' }}
              >
                {isBn ? 'বিষয়ভিত্তিক ফিল্টার' : 'Filter by subject'}
              </div>
              <div
                className="md:hidden text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {isBn
                  ? `${num(filteredQuestions.length)} টি প্রস্তুত`
                  : `${filteredQuestions.length} ready`}
              </div>
            </div>

            <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar py-0.5 snap-x">
              {SUBJECT_LIST.map(({ code, en, bn }) => {
                const isSelected = selectedSubjects.includes(code);
                const label = isBn ? bn : en;

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleSubjectFilter(code)}
                    className="shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-[14px] font-sans-app transition-all duration-200 border"
                    style={{
                      backgroundColor: isSelected ? 'var(--pill)' : 'var(--surface)',
                      color: isSelected ? 'var(--pill-ink)' : 'var(--ink)',
                      borderColor: isSelected ? 'transparent' : 'var(--line)',
                      fontWeight: isSelected ? 600 : 500,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--brand)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--line)';
                      }
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Far Right: Muted count (visible on desktop) */}
          <div
            className="hidden md:block text-[14px] font-sans-app shrink-0 self-end pb-1"
            style={{ color: 'var(--mute)' }}
          >
            {isBn
              ? `${num(filteredQuestions.length)} টি প্রশ্ন প্রস্তুত`
              : `${filteredQuestions.length} questions ready`}
          </div>
        </div>
      </section>

      {/* Main Question Surface */}
      <section className="py-1">
        {isLoadingShard ? (
          <div
            className="question-card-rounded border p-12 text-center animate-pulse"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--line)',
            }}
          >
            <div
              className="h-7 w-48 rounded-full mx-auto mb-4"
              style={{ backgroundColor: 'var(--surface2)' }}
            />
            <div
              className="h-4 w-72 sm:w-96 rounded-full mx-auto"
              style={{ backgroundColor: 'var(--surface2)' }}
            />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div
            className="question-card-rounded border p-8 sm:p-12 text-center"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--line)',
            }}
          >
            <p
              className="text-base sm:text-lg font-sans-app font-medium"
              style={{ color: 'var(--ink)' }}
            >
              {isBn
                ? 'এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি'
                : 'No questions match the selected filter'}
            </p>
            <button
              type="button"
              onClick={() => setSelectedSubjects([])}
              className="mt-4 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all"
              style={{
                backgroundColor: 'var(--pill)',
                color: 'var(--pill-ink)',
              }}
            >
              {isBn ? 'ফিল্টার রিসেট করুন' : 'Reset filters'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-[780px] mx-auto w-full">
            <QuestionCard
              key={activeQuestion.id}
              question={activeQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={filteredQuestions.length}
              mode="PRACTICE"
              onAnswerSelected={handleAnswerSelected}
              onNext={
                currentIndex < filteredQuestions.length - 1
                  ? () => setCurrentIndex((i) => i + 1)
                  : undefined
              }
            />

            {/* Question Carousel Navigation Bar */}
            <div
              className="p-3 sm:p-4 rounded-full border flex items-center justify-between shadow-sm transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border text-xs sm:text-sm font-medium transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
                style={{
                  backgroundColor: 'var(--surface2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{isBn ? 'পূর্ববর্তী' : 'Previous'}</span>
              </button>

              {/* Progress Indicator */}
              <div
                className="text-xs sm:text-sm font-serif-app font-semibold tabular-nums"
                style={{ color: 'var(--ink)' }}
              >
                <span>{num(currentIndex + 1)}</span>
                <span className="mx-1 sm:mx-1.5 font-normal" style={{ color: 'var(--mute)' }}>
                  /
                </span>
                <span>{num(filteredQuestions.length)}</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((i) => Math.min(filteredQuestions.length - 1, i + 1))
                }
                disabled={currentIndex === filteredQuestions.length - 1}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 shadow-sm"
                style={{
                  backgroundColor: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                <span>{isBn ? 'পরবর্তী প্রশ্ন' : 'Next Question'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
