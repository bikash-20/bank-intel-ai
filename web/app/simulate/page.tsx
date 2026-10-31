'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Timer,
  Award,
  RefreshCw,
  LayoutGrid,
} from 'lucide-react';
import { QuestionCard } from '../../components/mcq/QuestionCard';
import { DesktopNav } from '../../components/layout/DesktopNav';
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
      <div className="space-y-6">
        <DesktopNav />
        <div
          className="filter-panel-rounded border p-12 text-center animate-pulse"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          <div
            className="h-6 w-48 rounded-full mx-auto mb-4"
            style={{ backgroundColor: 'var(--surface2)' }}
          />
          <div
            className="h-4 w-64 rounded-full mx-auto"
            style={{ backgroundColor: 'var(--surface2)' }}
          />
        </div>
      </div>
    );
  }

  // Pre-Exam Launch Pad
  if (!isExamActive && !isFinished) {
    return (
      <div className="space-y-6">
        <DesktopNav />
        <div
          className="max-w-2xl mx-auto filter-panel-rounded border p-6 sm:p-10 text-center space-y-6 transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center mx-auto shadow-sm"
            style={{
              backgroundColor: 'var(--surface2)',
              color: 'var(--brand)',
              border: '1px solid var(--line)',
            }}
          >
            <Timer className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>

          <div>
            <h2
              className="text-2xl sm:text-3xl font-serif-app font-semibold mb-2"
              style={{ color: 'var(--ink)' }}
            >
              {t.simulator.title}
            </h2>
            <p
              className="text-sm sm:text-base font-sans-app max-w-lg mx-auto"
              style={{ color: 'var(--mute)' }}
            >
              {t.simulator.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left">
            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.simulator.duration}
              </div>
              <div
                className="text-base sm:text-xl font-serif-app font-semibold mt-0.5"
                style={{ color: 'var(--ink)' }}
              >
                {t.simulator.durationVal}
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.simulator.targetPerMcq}
              </div>
              <div
                className="text-base sm:text-xl font-serif-app font-semibold mt-0.5"
                style={{ color: 'var(--brand)' }}
              >
                {t.simulator.targetPerMcqVal}
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.simulator.penalty}
              </div>
              <div
                className="text-base sm:text-xl font-serif-app font-semibold mt-0.5"
                style={{ color: 'var(--bad)' }}
              >
                {t.simulator.penaltyVal}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartExam}
            className="w-full py-4 rounded-full font-semibold text-base sm:text-lg shadow-md transition-all active:scale-[0.99]"
            style={{
              backgroundColor: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            {t.simulator.beginButton}
          </button>
        </div>
      </div>
    );
  }

  // Post-Exam Review
  if (isFinished) {
    return (
      <div className="space-y-6">
        <DesktopNav />
        <div
          className="max-w-3xl mx-auto filter-panel-rounded border p-6 sm:p-10 space-y-6 transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="text-center">
            <div
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm"
              style={{
                backgroundColor: 'var(--okbg)',
                color: 'var(--ok)',
                border: '1px solid var(--ok)',
              }}
            >
              <Award className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <h2
              className="text-2xl sm:text-3xl font-serif-app font-semibold"
              style={{ color: 'var(--ink)' }}
            >
              {t.simulator.completedTitle}
            </h2>
            <p
              className="text-xs sm:text-sm font-sans-app mt-1"
              style={{ color: 'var(--mute)' }}
            >
              {t.simulator.formula}
            </p>
          </div>

          {/* Telemetry Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className="stat-card-rounded border p-4 text-center"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.metrics.netScore}
              </div>
              <div
                className="stat-number mt-0.5"
                style={{ color: 'var(--ok)' }}
              >
                {netScore >= 0 ? `+${num(netScore.toFixed(2))}` : num(netScore.toFixed(2))}
              </div>
            </div>

            <div
              className="stat-card-rounded border p-4 text-center"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.metrics.accuracy}
              </div>
              <div
                className="stat-number mt-0.5"
                style={{ color: 'var(--brand)' }}
              >
                {num(accuracy)}%
              </div>
            </div>

            <div
              className="stat-card-rounded border p-4 text-center"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.metrics.pace}
              </div>
              <div
                className="stat-number mt-0.5"
                style={{ color: 'var(--ink)' }}
              >
                {num(paceSecPerQuestion)}s
              </div>
            </div>

            <div
              className="stat-card-rounded border p-4 text-center"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
              }}
            >
              <div
                className="text-xs font-sans-app font-medium"
                style={{ color: 'var(--mute)' }}
              >
                {t.metrics.penaltyLost}
              </div>
              <div
                className="stat-number mt-0.5"
                style={{ color: 'var(--bad)' }}
              >
                -{num(riskIndexPointsLost.toFixed(2))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartExam}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border font-semibold text-base shadow-sm transition-all active:scale-[0.99]"
            style={{
              backgroundColor: 'var(--pill)',
              color: 'var(--pill-ink)',
              borderColor: 'transparent',
            }}
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t.simulator.retake}</span>
          </button>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[currentIndex];

  return (
    <div className="space-y-6">
      {/* Simulation Live Header Bar */}
      <div
        className="sticky top-4 z-40 p-4 rounded-full border flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-xl transition-colors"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
        }}
      >
        {/* Countdown Timer */}
        <div className="flex items-center gap-2.5">
          <Timer
            className="h-5 w-5"
            style={{
              color: timeLeft < 300 ? 'var(--bad)' : 'var(--ok)',
            }}
          />
          <div className="flex flex-col">
            <span
              className="text-[10px] font-sans-app font-medium"
              style={{ color: 'var(--mute)' }}
            >
              {t.metrics.timeRemaining}
            </span>
            <span
              className="font-serif-app text-xl font-bold tabular-nums"
              style={{
                color: timeLeft < 300 ? 'var(--bad)' : 'var(--ink)',
              }}
            >
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {/* Live Metrics Pills */}
        <div className="flex items-center gap-2 text-xs font-sans-app">
          <span
            className="px-3 py-1 rounded-full font-semibold border"
            style={{
              backgroundColor: 'var(--okbg)',
              borderColor: 'var(--ok)',
              color: 'var(--ok)',
            }}
          >
            {isBn ? 'স্কোর:' : 'Score:'}{' '}
            {netScore >= 0 ? `+${num(netScore.toFixed(2))}` : num(netScore.toFixed(2))}
          </span>

          <span
            className="px-3 py-1 rounded-full font-semibold border"
            style={{
              backgroundColor: 'var(--badbg)',
              borderColor: 'var(--bad)',
              color: 'var(--bad)',
            }}
          >
            {isBn ? 'কর্তন:' : 'Lost:'} -{num(riskIndexPointsLost.toFixed(2))}
          </span>

          <button
            type="button"
            onClick={() => setShowMobilePalette((p) => !p)}
            className="md:hidden px-3 py-1 rounded-full border font-semibold flex items-center gap-1"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>{num(currentIndex + 1)}/{num(questions.length)}</span>
          </button>
        </div>

        {/* Finish Exam Button */}
        <button
          type="button"
          onClick={() => setIsFinished(true)}
          className="px-4 py-2 rounded-full border text-xs sm:text-sm font-semibold transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--badbg)',
            borderColor: 'var(--bad)',
            color: 'var(--bad)',
          }}
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

      {/* Question Palette Grid */}
      <div
        className={`filter-panel-rounded border p-5 space-y-3 transition-colors ${
          showMobilePalette ? 'block' : 'hidden md:block'
        }`}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
        }}
      >
        <div
          className="flex items-center justify-between text-xs font-sans-app border-b pb-2.5"
          style={{ borderColor: 'var(--line)' }}
        >
          <span
            className="font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            {t.simulator.paletteTitle} ({num(questions.length)})
          </span>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1"
              style={{ color: 'var(--ok)' }}
            >
              ● {t.metrics.attempted}
            </span>
            <span
              className="flex items-center gap-1"
              style={{ color: 'var(--mute)' }}
            >
              ○ {t.metrics.unattempted}
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
                className="min-h-[36px] w-full rounded-full text-xs font-serif-app font-semibold tabular-nums transition-all active:scale-95 border"
                style={{
                  backgroundColor: isCurrent
                    ? 'var(--pill)'
                    : hasAnswered
                    ? 'var(--okbg)'
                    : 'var(--surface2)',
                  color: isCurrent
                    ? 'var(--pill-ink)'
                    : hasAnswered
                    ? 'var(--ok)'
                    : 'var(--mute)',
                  borderColor: isCurrent
                    ? 'transparent'
                    : hasAnswered
                    ? 'var(--ok)'
                    : 'var(--line)',
                }}
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
