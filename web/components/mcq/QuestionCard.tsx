'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, Sparkles, ChevronRight } from 'lucide-react';
import { MathText } from './MathText';
import { OptionRow } from './OptionRow';
import { AIExplainPanel } from './AIExplainPanel';
import { clientExplanationLRU } from '../../lib/db/lru';
import {
  getExplanationFromIDB,
  saveExplanationToIDB,
  recordUserAttempt,
  toggleBookmark,
} from '../../lib/db/idb';
import { useI18n } from '../../lib/i18n/context';
import type {
  AIExplanationPayload,
  OptionKey,
  QuestionItem,
  UserAttempt,
} from '../../lib/types';

interface QuestionCardProps {
  question: QuestionItem;
  questionNumber: number;
  totalQuestions: number;
  mode?: 'PRACTICE' | 'SIMULATOR';
  isBookmarked?: boolean;
  onAnswerSelected?: (attempt: UserAttempt) => void;
  onNext?: () => void;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)] ?? d);
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  totalQuestions,
  mode = 'PRACTICE',
  isBookmarked: initialBookmarked = false,
  onAnswerSelected,
  onNext,
}) => {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanationPayload | undefined>(
    question.staticExplanation
  );
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explainError, setExplainError] = useState<string | undefined>();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [startTime] = useState<number>(Date.now());

  // Reset state on question change
  useEffect(() => {
    setSelectedOption(null);
    setHasSubmitted(false);
    setShowExplanation(false);
    setExplanation(question.staticExplanation);
    setExplainError(undefined);
  }, [question.id, question.staticExplanation]);

  const handleSelectOption = useCallback(
    async (key: OptionKey) => {
      if (hasSubmitted) return;

      const isCorrect = key === question.correctOption;
      setSelectedOption(key);
      setHasSubmitted(true);

      const timeSpentMs = Date.now() - startTime;
      const attempt: UserAttempt = {
        questionId: question.id,
        selectedOption: key,
        isCorrect,
        timeSpentMs,
        timestamp: Date.now(),
        mode,
      };

      try {
        await recordUserAttempt(attempt);
      } catch (err: any) {
        console.warn('IDB write attempt warning:', err?.message);
      }

      onAnswerSelected?.(attempt);
    },
    [hasSubmitted, question.correctOption, question.id, startTime, mode, onAnswerSelected]
  );

  const fetchAIExplanation = useCallback(async () => {
    if (explanation) {
      setShowExplanation((prev) => !prev);
      return;
    }

    setShowExplanation(true);
    setIsLoadingExplanation(true);
    setExplainError(undefined);

    // 1. Check L1 Client RAM LRU
    const memoryHit = clientExplanationLRU.get(question.hash);
    if (memoryHit) {
      setExplanation(memoryHit);
      setIsLoadingExplanation(false);
      return;
    }

    // 2. Check L2 IndexedDB
    try {
      const idbHit = await getExplanationFromIDB(question.id);
      if (idbHit) {
        clientExplanationLRU.set(question.hash, idbHit);
        setExplanation(idbHit);
        setIsLoadingExplanation(false);
        return;
      }
    } catch (e: any) {
      console.warn('IDB explanation read error:', e?.message);
    }

    // 3. Network Fetch to Cloudflare Worker
    try {
      const workerUrl =
        process.env.NEXT_PUBLIC_WORKER_URL ||
        'https://bank-intel-worker.talukderbikash500.workers.dev';

      const res = await fetch(`${workerUrl}/api/v1/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          hash: question.hash,
          subject: question.subject,
          stem: question.stem,
          options: question.options,
          correctOption: question.correctOption,
        }),
      });

      if (!res.ok) {
        throw new Error(`Worker returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.ok && json.data) {
        const payload = json.data as AIExplanationPayload;
        clientExplanationLRU.set(question.hash, payload);
        await saveExplanationToIDB(payload);
        setExplanation(payload);
      } else {
        throw new Error(json.error || 'Failed to generate explanation.');
      }
    } catch (err: any) {
      console.error('AI Explain fetch error:', err?.message);
      setExplainError(
        isBn
          ? 'অফলাইনে নতুন এআই ব্যাখ্যা লোড করা সম্ভব হয়নি।'
          : 'Edge AI explanation unavailable offline without pre-cache.'
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [explanation, question, isBn]);

  const handleToggleBookmark = async () => {
    try {
      const newState = await toggleBookmark(question.id);
      setBookmarked(newState);
    } catch (err: any) {
      console.warn('Failed to toggle bookmark:', err?.message);
    }
  };

  // Keyboard navigation listener (1-4/A-D, E, ArrowRight/Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toUpperCase();

      if (!hasSubmitted) {
        if (key === '1' || key === 'A') handleSelectOption('A');
        if (key === '2' || key === 'B') handleSelectOption('B');
        if (key === '3' || key === 'C') handleSelectOption('C');
        if (key === '4' || key === 'D') handleSelectOption('D');
      }

      if (key === 'E') {
        e.preventDefault();
        fetchAIExplanation();
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (onNext && hasSubmitted) {
          e.preventDefault();
          onNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSubmitted, handleSelectOption, fetchAIExplanation, onNext]);

  const appearance = question.appearances?.[0];
  const subjectName = t.subjects[question.subject] || question.subject;

  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl border border-white/10 bg-obsidian-900/85 p-5 sm:p-8 backdrop-blur-2xl shadow-2xl transition-all duration-300 relative overflow-hidden">
      {/* Top Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 pb-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs sm:text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-lg ${
              isBn ? 'font-bengali' : 'font-mono'
            }`}
          >
            {t.card.questionLabel} {num(questionNumber)} {t.card.of} {num(totalQuestions)}
          </span>

          <span
            className={`text-xs sm:text-sm font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-lg uppercase ${
              isBn ? 'font-bengali' : 'font-mono'
            }`}
          >
            {subjectName}
          </span>

          {appearance && (
            <span className="font-mono text-xs text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg hidden sm:inline-block">
              {appearance.examBody} {appearance.post} ({appearance.year})
              {appearance.faculty && ` • ${appearance.faculty}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleToggleBookmark}
            title={bookmarked ? t.card.bookmarked : t.card.bookmark}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
              bookmarked
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/25'
            }`}
          >
            <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" fill={bookmarked ? 'currentColor' : 'none'} />
          </button>

          {/* AI Explain Toggle */}
          <button
            type="button"
            onClick={fetchAIExplanation}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 ${
              isBn ? 'font-bengali' : 'font-mono'
            } ${
              showExplanation
                ? 'border-indigo-500/60 bg-indigo-500/25 text-indigo-200 shadow-[0_0_18px_rgba(99,102,241,0.25)]'
                : 'border-white/10 bg-white/5 text-indigo-300 hover:border-indigo-500/40 hover:bg-indigo-500/15'
            }`}
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>{t.card.aiExplain}</span>
          </button>
        </div>
      </div>

      {/* Question Stem */}
      <div className="text-xl sm:text-2xl font-medium text-slate-100 leading-relaxed mb-7 tracking-normal">
        <MathText content={question.stem} />
      </div>

      {/* 4 Options */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6">
        {OPTION_KEYS.map((key) => {
          const text = question.options[key];
          const isSelected = selectedOption === key;
          const isCorrect = key === question.correctOption;
          const diagnostic = explanation?.optionDiagnostics?.[key];

          return (
            <OptionRow
              key={key}
              optionKey={key}
              text={text}
              isSelected={isSelected}
              isCorrectOption={isCorrect}
              hasSubmitted={hasSubmitted}
              diagnostic={diagnostic}
              showExplanation={showExplanation}
              onSelect={() => handleSelectOption(key)}
            />
          );
        })}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
        <div
          className={`text-xs sm:text-sm text-slate-400 flex items-center gap-2 ${
            isBn ? 'font-bengali' : 'font-mono'
          }`}
        >
          <span>{t.card.shortcutHelp}</span>
        </div>

        {onNext && hasSubmitted && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 border border-indigo-400/30 px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] active:scale-95"
          >
            <span>{t.card.nextQuestion}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Expanded AI Explanation Drawer */}
      {showExplanation && (
        <div className="mt-7 pt-6 border-t border-white/10">
          <AIExplainPanel
            payload={explanation}
            isLoading={isLoadingExplanation}
            error={explainError}
            correctOption={question.correctOption}
            onRetry={fetchAIExplanation}
          />
        </div>
      )}
    </div>
  );
};
