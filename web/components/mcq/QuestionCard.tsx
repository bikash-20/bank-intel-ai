'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, ChevronRight } from 'lucide-react';
import { MathText } from './MathText';
import { OptionRow } from './OptionRow';
import { AIExplainSection } from './AIExplainSection';
import { recordUserAttempt, toggleBookmark } from '../../lib/db/idb';
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
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [startTime] = useState<number>(Date.now());

  // Reset state on question change
  useEffect(() => {
    setSelectedOption(null);
    setHasSubmitted(false);
  }, [question.id]);

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

  const handleToggleBookmark = async () => {
    try {
      const newState = await toggleBookmark(question.id);
      setBookmarked(newState);
    } catch (err: any) {
      console.warn('Failed to toggle bookmark:', err?.message);
    }
  };

  // Keyboard navigation listener (1-4/A-D, ArrowRight/Space)
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

      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (onNext && hasSubmitted) {
          e.preventDefault();
          onNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSubmitted, handleSelectOption, onNext]);

  const appearance = question.appearances?.[0];
  const subjectName = t.subjects[question.subject] || question.subject;
  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl border border-white/10 bg-obsidian-900/85 p-4 sm:p-8 backdrop-blur-2xl shadow-2xl transition-all duration-300 relative overflow-hidden">
      {/* Top Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 pb-3.5 mb-5 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs sm:text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-xl ${
              isBn ? 'font-bengali' : 'font-mono'
            }`}
          >
            {t.card.questionLabel} {num(questionNumber)} {t.card.of} {num(totalQuestions)}
          </span>

          <span
            className={`text-xs sm:text-sm font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-xl uppercase ${
              isBn ? 'font-bengali' : 'font-mono'
            }`}
          >
            {subjectName}
          </span>

          {appearance && (
            <span className="font-mono text-xs text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl hidden sm:inline-block">
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
        </div>
      </div>

      {/* Question Stem */}
      <div className="text-xl sm:text-2xl font-medium text-slate-100 leading-relaxed mb-6 tracking-normal">
        <MathText content={question.stem} />
      </div>

      {/* 4 Options (A, B, C, D) */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3.5 mb-2">
        {OPTION_KEYS.map((key) => {
          const text = question.options[key];
          const isSelected = selectedOption === key;
          const isCorrect = key === question.correctOption;

          return (
            <OptionRow
              key={key}
              optionKey={key}
              text={text}
              isSelected={isSelected}
              isCorrectOption={isCorrect}
              hasSubmitted={hasSubmitted}
              showExplanation={false}
              onSelect={() => handleSelectOption(key)}
            />
          );
        })}
      </div>

      {/* ALWAYS-VISIBLE AI EXPLAIN TOGGLE BAR & EXPANDABLE DRAWER DIRECTLY BELOW OPTION D */}
      <AIExplainSection
        questionId={question.id}
        hash={question.hash}
        subject={question.subject}
        stem={question.stem}
        options={question.options}
        correctOption={question.correctOption}
        selectedOption={selectedOption}
        initialExplanation={question.staticExplanation}
      />

      {/* Bottom Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 pt-4 mt-4 border-t border-white/10">
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
    </div>
  );
};
