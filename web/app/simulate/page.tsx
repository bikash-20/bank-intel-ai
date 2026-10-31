'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Timer,
  Award,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LayoutGrid,
} from 'lucide-react';
import { QuestionCard } from '../../components/mcq/QuestionCard';
import { getAllQuestionsFromIDB, bulkWriteQuestions } from '../../lib/db/idb';
import { useI18n } from '../../lib/i18n/context';
import type { QuestionItem, UserAttempt } from '../../lib/types';

const TOTAL_TIME_SECONDS = 60 * 60; // 60 minutes

function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)] ?? d);
}

export default function SimulatorPage() {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAttempt>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SECONDS);
  const [isExamActive, setIsExamActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  // Load simulator questions from BB AD 2026 shard
  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      let qs: QuestionItem[] = [];
      try {
        qs = await getAllQuestionsFromIDB();
      } catch (e) {
        console.warn('IDB read error:', e);
      }

      if (qs.length === 0) {
        const res = await fetch('/shards/bb-ad-2026.json');
        if (!res.ok) throw new Error('Failed to fetch shard');
        qs = await res.json();
        try {
          await bulkWriteQuestions(qs);
        } catch (e) {
          console.warn('IDB write error:', e);
        }
      }
      setQuestions(qs);
    } catch (err: any) {
      console.error('Failed to load simulator questions:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Countdown timer
  useEffect(() => {
    if (!isExamActive || isFinished) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamActive, isFinished]);

  const handleStartExam = () => {
    setUserAnswers({});
    setTimeLeft(TOTAL_TIME_SECONDS);
    setIsFinished(false);
    setIsExamActive(true);
    setCurrentIndex(0);
  };

  const handleAnswerSelected = (attempt: UserAttempt) => {
    setUserAnswers((prev) => ({
      ...prev,
      [attempt.questionId]: attempt,
    }));
  };

  // Metrics computation
  const attemptsArray = useMemo(() => Object.values(userAnswers), [userAnswers]);
  const correctCount = useMemo(
    () => attemptsArray.filter((a) => a.isCorrect).length,
    [attemptsArray]
  );
  const wrongCount = useMemo(
    () => attemptsArray.filter((a) => !a.isCorrect).length,
    [attemptsArray]
  );
  const netScore = correctCount * 1.0 - wrongCount * 0.25;
  const attemptedCount = attemptsArray.length;
  const accuracy =
    attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 100;

  const timeElapsed = TOTAL_TIME_SECONDS - timeLeft;
  const paceSecPerQuestion =
    attemptedCount > 0 ? Math.round(timeElapsed / attemptedCount) : 0;
  const riskIndexPointsLost = wrongCount * 0.25;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return num(formatted);
  };

  if (isLoading) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center animate-pulse border border-white/10">
        <div className="h-6 w-48 rounded bg-white/10 mx-auto mb-4" />
        <div className="h-4 w-64 rounded bg-white/10 mx-auto" />
      </div>
    );
  }

  // Pre-Exam Launch Pad
  if (!isExamActive && !isFinished) {
    return (
      <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-6 sm:p-10 text-center space-y-6 border border-white/10 shadow-2xl">
        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          <Timer className="h-8 w-8 sm:h-10 sm:w-10" />
        </div>

        <div>
          <h2
            className={`text-2xl sm:text-3xl font-bold text-white mb-2 ${
              isBn ? 'font-bengali' : 'font-display'
            }`}
          >
            {t.simulator.title}
          </h2>
          <p className={`text-sm sm:text-base text-slate-300 ${isBn ? 'font-bengali' : ''}`}>
            {t.simulator.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-left">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.simulator.duration}
            </div>
            <div
              className={`text-base sm:text-xl font-bold text-white mt-0.5 ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.simulator.durationVal}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.simulator.targetPerMcq}
            </div>
            <div
              className={`text-base sm:text-xl font-bold text-amber-400 mt-0.5 ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.simulator.targetPerMcqVal}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.simulator.penalty}
            </div>
            <div
              className={`text-base sm:text-xl font-bold text-rose-400 mt-0.5 ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.simulator.penaltyVal}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartExam}
          className={`w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 text-white font-bold text-base sm:text-lg shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all active:scale-[0.99] ${
            isBn ? 'font-bengali text-xl' : ''
          }`}
        >
          {t.simulator.beginButton}
        </button>
      </div>
    );
  }

  // Post-Exam Comprehensive Review
  if (isFinished) {
    return (
      <div className="max-w-3xl mx-auto glass-panel rounded-3xl p-6 sm:p-10 space-y-6 border border-white/10 shadow-2xl">
        <div className="text-center">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-3 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <Award className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <h2
            className={`text-2xl sm:text-3xl font-bold text-white ${
              isBn ? 'font-bengali' : 'font-display'
            }`}
          >
            {t.simulator.completedTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-mono mt-1">
            {t.simulator.formula}
          </p>
        </div>

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 text-center">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.netScore}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
              {netScore >= 0 ? `+${num(netScore.toFixed(2))}` : num(netScore.toFixed(2))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 text-center">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.accuracy}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-indigo-300 tabular-nums mt-0.5">
              {num(accuracy)}%
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 text-center">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.pace}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-400 tabular-nums mt-0.5">
              {num(paceSecPerQuestion)}s
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 text-center">
            <div
              className={`text-[11px] sm:text-xs font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.penaltyLost}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-rose-400 tabular-nums mt-0.5">
              -{num(riskIndexPointsLost.toFixed(2))}
            </div>
          </div>
        </div>

        {/* Detail Breakdown */}
        <div
          className={`rounded-2xl border border-white/10 bg-black/30 p-5 space-y-3 text-xs sm:text-sm ${
            isBn ? 'font-bengali text-base' : 'font-mono'
          }`}
        >
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-slate-400">{t.simulator.totalQuestions}</span>
            <span className="text-white font-bold">{num(questions.length)}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-slate-400">{t.metrics.attempted}:</span>
            <span className="text-white font-bold">{num(attemptedCount)}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-emerald-400">{t.simulator.correctAnswers}</span>
            <span className="text-emerald-400 font-bold">{num(correctCount)}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-rose-400">{t.simulator.wrongAnswers}</span>
            <span className="text-rose-400 font-bold">{num(wrongCount)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-indigo-300 font-bold">
              {t.simulator.estimatedPercentile}
            </span>
            <span className="text-indigo-300 font-bold">
              {isBn
                ? netScore >= 65
                  ? 'টপ ১% (মৌখিক পরীক্ষার জন্য নির্বাচিত)'
                  : netScore >= 50
                  ? 'টপ ১০% (ভালো অবস্থান)'
                  : 'আরও প্রস্তুতি প্রয়োজন'
                : netScore >= 65
                ? 'Top 1% (Viva Qualified)'
                : netScore >= 50
                ? 'Top 10%'
                : 'Needs Revision'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartExam}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 font-semibold text-white transition-all active:scale-[0.99] ${
            isBn ? 'font-bengali text-lg' : ''
          }`}
        >
          <RefreshCw className="h-5 w-5" />
          <span>{t.simulator.retake}</span>
        </button>
      </div>
    );
  }

  const activeQuestion = questions[currentIndex];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Live Simulation Sticky Bar */}
      <div className="glass-panel sticky top-16 z-40 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 border border-white/10">
        {/* Countdown Timer with Warning State */}
        <div className="flex items-center gap-2">
          <Timer
            className={`h-5 w-5 ${
              timeLeft < 300 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
            }`}
          />
          <div className="flex flex-col">
            <span
              className={`text-[10px] font-semibold text-slate-400 uppercase ${
                isBn ? 'font-bengali' : 'font-mono'
              }`}
            >
              {t.metrics.timeRemaining}
            </span>
            <span
              className={`font-mono text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${
                timeLeft < 300 ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {/* Live Telemetry Pills */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 tabular-nums font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isBn ? 'স্কোর:' : 'Score:'}{' '}
              {netScore >= 0 ? `+${num(netScore.toFixed(2))}` : num(netScore.toFixed(2))}
            </span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 tabular-nums font-semibold">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isBn ? 'কর্তন:' : 'Lost:'} -{num(riskIndexPointsLost.toFixed(2))}
            </span>
          </div>

          {/* Toggle Question Palette on Mobile */}
          <button
            type="button"
            onClick={() => setShowMobilePalette((p) => !p)}
            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold"
            aria-label="Toggle Question Grid"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>{num(currentIndex + 1)}/{num(questions.length)}</span>
          </button>
        </div>

        {/* Finish Exam Button */}
        <button
          type="button"
          onClick={() => setIsFinished(true)}
          className={`min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs sm:text-sm font-bold transition-all active:scale-95 ${
            isBn ? 'font-bengali text-base' : 'font-mono'
          }`}
        >
          {t.simulator.submitExam}
        </button>
      </div>

      {/* Main Question Display */}
      {activeQuestion && (
        <QuestionCard
          key={activeQuestion.id}
          question={activeQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          mode="SIMULATOR"
          onAnswerSelected={handleAnswerSelected}
          onNext={
            currentIndex < questions.length - 1
              ? () => setCurrentIndex((i) => i + 1)
              : undefined
          }
        />
      )}

      {/* Question Palette Grid (Responsive & Collapsible on Mobile) */}
      <div
        className={`glass-panel rounded-2xl p-4 sm:p-5 space-y-3 border border-white/10 ${
          showMobilePalette ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-2.5">
          <span className={`font-semibold ${isBn ? 'font-bengali text-sm text-slate-300' : 'font-mono'}`}>
            {t.simulator.paletteTitle} ({num(questions.length)})
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> {t.metrics.attempted}
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-white/20" /> {t.metrics.unattempted}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-20 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {questions.map((q, idx) => {
            const hasAnswered = !!userAnswers[q.id];
            const isCurrent = currentIndex === idx;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowMobilePalette(false);
                }}
                className={`min-h-[36px] w-full rounded-xl font-mono text-xs tabular-nums transition-all active:scale-95 ${
                  isCurrent
                    ? 'border-2 border-indigo-400 font-bold bg-indigo-500/30 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                    : hasAnswered
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold'
                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {num(idx + 1)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
