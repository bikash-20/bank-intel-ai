'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  Filter,
  Flame,
  CheckCircle,
  XCircle,
  ArrowRight,
  Database,
  Layers,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
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
import { useI18n } from '../lib/i18n/context';
import type {
  QuestionItem,
  ShardManifest,
  SubjectCode,
  UserAttempt,
} from '../lib/types';

const SUBJECT_CONFIG: { code: SubjectCode; icon: string }[] = [
  { code: 'MATH', icon: '∑' },
  { code: 'ENGLISH', icon: 'Aa' },
  { code: 'ANALYTICAL', icon: '🧠' },
  { code: 'COMPUTER_ICT', icon: '💻' },
  { code: 'GENERAL_KNOWLEDGE', icon: '🌐' },
];

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

        // Check if cached in IndexedDB
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

        // If not in IDB or hash changed, fetch JSON shard
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

        // Build in-memory bitmask index: O(N)
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

  // 2. Compute filtered question list via Bitmask Index: O(N / 32)
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
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Telemetry Bar (Mobile First 2x2 Grid) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Net Score */}
        <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/10 hover:border-emerald-500/30 transition-colors">
          <div>
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.netScore}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums tracking-tight mt-0.5">
              {netScore >= 0 ? `+${num(netScore.toFixed(2))}` : num(netScore.toFixed(2))}
            </div>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Accuracy */}
        <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/10 hover:border-indigo-500/30 transition-colors">
          <div>
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.accuracy}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-indigo-300 tabular-nums tracking-tight mt-0.5">
              {num(accuracy)}%
            </div>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Penalty Lost */}
        <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/10 hover:border-rose-500/30 transition-colors">
          <div>
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.penaltyLost}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-rose-400 tabular-nums tracking-tight mt-0.5">
              -{num((sessionWrong * 0.25).toFixed(2))}
            </div>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Daily Streak */}
        <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/10 hover:border-amber-500/30 transition-colors">
          <div>
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.streak}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-400 tabular-nums tracking-tight mt-0.5 flex items-baseline gap-1">
              {num(bootSummary.streakDays)}
              <span className={`text-xs text-amber-300 font-normal ${isBn ? 'font-bengali' : 'font-mono'}`}>
                {t.metrics.days}
              </span>
            </div>
          </div>
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </section>

      {/* Exam Shard Selector & Multi-Facet Filter Matrix */}
      <section className="glass-panel rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3 sm:space-y-4 border border-white/10">
        {/* Shard Selection Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-400 shrink-0" />
            <span
              className={`text-xs font-semibold uppercase text-slate-300 ${
                isBn ? 'font-bengali text-sm' : 'font-mono'
              }`}
            >
              {t.filter.examShard}
            </span>
          </div>

          {/* Shard Buttons (Horizontal scrollable on small screens) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 -mx-1 px-1">
            {manifest?.shards.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleShardChange(s.id)}
                className={`text-xs sm:text-sm px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap active:scale-95 ${
                  selectedShardId === s.id
                    ? 'border-indigo-500 bg-indigo-500/25 text-white font-bold shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{s.title}</span>{' '}
                <span className="text-[11px] font-mono opacity-80">
                  ({num(s.questionCount)})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Facet Subject Pills (Touch-Friendly Horizontal Scroll) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 pr-1">
            <Filter className="h-3.5 w-3.5 text-indigo-400" />
            <span className={isBn ? 'font-bengali text-sm font-medium' : 'font-mono'}>
              {t.filter.facets}
            </span>
          </div>

          {SUBJECT_CONFIG.map(({ code, icon }) => {
            const isSelected = selectedSubjects.includes(code);
            const label = t.subjects[code];
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleSubjectFilter(code)}
                className={`text-xs sm:text-sm px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/30 text-white font-semibold shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                } ${isBn ? 'font-bengali' : ''}`}
              >
                <span className="text-xs opacity-75">{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}

          {selectedSubjects.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSubjects([])}
              className={`text-xs text-indigo-300 hover:text-white underline underline-offset-4 shrink-0 px-2 active:scale-95 ${
                isBn ? 'font-bengali' : ''
              }`}
            >
              {t.filter.resetFilters}
            </button>
          )}

          <div
            className={`ml-auto font-mono text-xs text-slate-400 shrink-0 hidden md:block ${
              isBn ? 'font-bengali text-sm' : ''
            }`}
          >
            {num(filteredQuestions.length)} {t.filter.questionsLoaded}
          </div>
        </div>
      </section>

      {/* Main Question Surface */}
      <section className="py-1">
        {isLoadingShard ? (
          <div className="glass-panel rounded-3xl p-8 sm:p-14 text-center animate-pulse border border-white/10">
            <div className="h-8 w-48 rounded-xl bg-white/10 mx-auto mb-4" />
            <div className="h-4 w-72 sm:w-96 rounded-lg bg-white/10 mx-auto" />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center border border-white/10">
            <Layers className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            <p className={`text-slate-200 text-base sm:text-lg font-medium ${isBn ? 'font-bengali' : ''}`}>
              {t.filter.noQuestionsMatch}
            </p>
            <button
              type="button"
              onClick={() => setSelectedSubjects([])}
              className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 text-sm font-semibold transition-all ${
                isBn ? 'font-bengali' : ''
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>{t.filter.clearFilters}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
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

            {/* Touch-Friendly Question Carousel Bar */}
            <div className="glass-panel rounded-2xl p-3 sm:p-4 flex items-center justify-between border border-white/10">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className={`min-h-[44px] px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-sm sm:text-base font-medium disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 active:scale-95 transition-all ${
                  isBn ? 'font-bengali' : 'font-mono'
                }`}
              >
                ← {t.card.previous}
              </button>

              <div
                className={`text-xs sm:text-sm font-medium text-slate-400 tabular-nums ${
                  isBn ? 'font-bengali text-base' : 'font-mono'
                }`}
              >
                {t.card.jumpTo}: <span className="font-bold text-white">{num(currentIndex + 1)}</span> {t.card.of}{' '}
                <span className="font-bold text-white">{num(filteredQuestions.length)}</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((i) => Math.min(filteredQuestions.length - 1, i + 1))
                }
                disabled={currentIndex === filteredQuestions.length - 1}
                className={`min-h-[44px] px-4 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-200 text-sm sm:text-base font-semibold disabled:opacity-30 disabled:pointer-events-none hover:bg-indigo-500/30 active:scale-95 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(99,102,241,0.2)] ${
                  isBn ? 'font-bengali' : 'font-mono'
                }`}
              >
                <span>{t.card.nextQuestion}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
