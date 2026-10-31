'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bookmark, ChevronRight } from 'lucide-react';
import { MathText } from './MathText';
import { OptionRow } from './OptionRow';
import { AIExplainSection } from './AIExplainSection';
import { recordUserAttempt, toggleBookmark } from '../../lib/db/idb';
import { useI18n } from '../../lib/i18n/context';
import type {
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

  // Reset selection when question changes
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

  // Keyboard navigation listener (1-4 / A-D, Space / ArrowRight)
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
    <div
      className="w-full question-card-rounded border p-5 sm:p-9 transition-colors duration-300"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
        boxShadow: 'var(--shadow)',
      }}
    >
      {/* Top Metadata Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 mb-6"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Question count pill */}
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            {isBn ? 'প্রশ্ন' : 'Question'} {num(questionNumber)} {isBn ? '/' : 'of'} {num(totalQuestions)}
          </span>

          {/* Subject badge pill */}
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--brand)',
            }}
          >
            {subjectName}
          </span>

          {/* Exam appearance badge pill */}
          {appearance && (
            <span
              className="px-3.5 py-1.5 rounded-full text-xs border hidden sm:inline-block"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
                color: 'var(--mute)',
              }}
            >
              {appearance.examBody} {appearance.post} ({num(appearance.year)})
              {appearance.faculty && ` • ${appearance.faculty}`}
            </span>
          )}
        </div>

        {/* Bookmark Button */}
        <button
          type="button"
          onClick={handleToggleBookmark}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
          className="h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm"
          style={{
            backgroundColor: bookmarked ? 'var(--brand)' : 'var(--surface2)',
            color: bookmarked ? 'var(--brand-ink)' : 'var(--mute)',
            borderColor: bookmarked ? 'var(--brand)' : 'var(--line)',
          }}
        >
          <Bookmark
            className="h-4 w-4"
            fill={bookmarked ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      {/* Question Text in --serif weight 500, clamp(26px, 4.2vw, 38px) */}
      <div className="question-heading mb-7">
        <MathText content={question.stem} />
      </div>

      {/* 4 Options (A, B, C, D / ক, খ, গ, ঘ) as fully rounded pills */}
      <div className="grid grid-cols-1 gap-3 sm:gap-3.5 mb-2">
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

      {/* ALWAYS-VISIBLE AI EXPLAIN TOGGLE BAR & EXPANDABLE DRAWER */}
      <AIExplainSection
        questionId={question.id}
        hash={question.hash}
        subject={question.subject}
        stem={question.stem}
        options={question.options}
        correctOption={question.correctOption}
        selectedOption={selectedOption}
      />

      {/* Bottom Action Footer with Next Question button */}
      {onNext && hasSubmitted && (
        <div
          className="flex items-center justify-end pt-5 mt-5 border-t"
          style={{ borderColor: 'var(--line)' }}
        >
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 px-7 py-3 rounded-full text-base font-semibold shadow-md transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            <span className="font-sans-app">{t.card.nextQuestion}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};
