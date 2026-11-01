'use client';

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { MathText } from './MathText';
import { useI18n } from '../../lib/i18n/context';
import type { OptionDiagnostic, OptionKey } from '../../lib/types';

interface OptionRowProps {
  optionKey: OptionKey;
  text: string;
  isSelected: boolean;
  isCorrectOption: boolean;
  hasSubmitted: boolean;
  diagnostic?: OptionDiagnostic;
  showExplanation: boolean;
  onSelect: () => void;
}

export const OptionRow: React.FC<OptionRowProps> = ({
  optionKey,
  text,
  isSelected,
  isCorrectOption,
  hasSubmitted,
  onSelect,
}) => {
  const { locale } = useI18n();
  const isBn = locale === 'bn';

  // Bengali option letter mapping
  const displayKey = isBn
    ? optionKey === 'A'
      ? 'ক'
      : optionKey === 'B'
      ? 'খ'
      : optionKey === 'C'
      ? 'গ'
      : 'ঘ'
    : optionKey;

  // Determine styles matching the token specification
  let containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface)',
    borderColor: 'var(--line)',
    color: 'var(--ink)',
  };

  let circleStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface2)',
    color: 'var(--ink)',
    borderColor: 'var(--line)',
  };

  if (hasSubmitted) {
    if (isCorrectOption) {
      containerStyle = {
        backgroundColor: 'var(--okbg)',
        borderColor: 'var(--ok)',
        color: 'var(--ok)',
      };
      circleStyle = {
        backgroundColor: 'var(--ok)',
        color: '#ffffff',
        borderColor: 'var(--ok)',
      };
    } else if (isSelected) {
      containerStyle = {
        backgroundColor: 'var(--badbg)',
        borderColor: 'var(--bad)',
        color: 'var(--bad)',
      };
      circleStyle = {
        backgroundColor: 'var(--bad)',
        color: '#ffffff',
        borderColor: 'var(--bad)',
      };
    } else {
      containerStyle = {
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
        color: 'var(--mute)',
        opacity: 0.55,
      };
      circleStyle = {
        backgroundColor: 'var(--surface2)',
        color: 'var(--mute)',
        borderColor: 'var(--line)',
      };
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={hasSubmitted}
      style={containerStyle}
      className={`group relative flex w-full items-center gap-3.5 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-[24px] sm:rounded-full border text-left transition-all duration-200 min-h-[54px] sm:min-h-[58px] ${
        !hasSubmitted
          ? 'cursor-pointer hover:border-[var(--brand)] active:scale-[0.99]'
          : 'cursor-default'
      }`}
    >
      {/* Option Letter Circle (36px round circle in --serif weight 600) */}
      <span
        style={circleStyle}
        className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border font-serif-app text-base sm:text-lg font-semibold transition-colors duration-200 shadow-sm"
      >
        {displayKey}
      </span>

      {/* Option Text in --sans (16px-18px) */}
      <div className="flex-1 font-sans-app text-base sm:text-[17px] leading-relaxed">
        <MathText content={text} />
      </div>

      {/* Submission Feedback Icon */}
      {hasSubmitted && (
        <div className="flex shrink-0 items-center">
          {isCorrectOption ? (
            <CheckCircle2 className="h-6 w-6 text-[var(--ok)] animate-in fade-in zoom-in duration-200" />
          ) : isSelected ? (
            <XCircle className="h-6 w-6 text-[var(--bad)] animate-in fade-in zoom-in duration-200" />
          ) : null}
        </div>
      )}
    </button>
  );
};
