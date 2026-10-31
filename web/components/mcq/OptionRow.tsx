'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
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
  diagnostic,
  showExplanation,
  onSelect,
}) => {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  // Determine state styles
  let borderStyle = 'border-white/10 hover:border-white/25 hover:bg-white/[0.03] active:bg-white/[0.05]';
  let badgeStyle = 'bg-white/5 text-slate-200 border-white/10';
  let textStyle = 'text-slate-100';

  if (hasSubmitted) {
    if (isCorrectOption) {
      borderStyle = 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30';
      badgeStyle = 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-bold';
      textStyle = 'text-emerald-100 font-semibold';
    } else if (isSelected) {
      borderStyle = 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30';
      badgeStyle = 'bg-rose-500/25 text-rose-300 border-rose-500/50 font-bold';
      textStyle = 'text-rose-100 font-semibold';
    } else {
      borderStyle = 'border-white/5 opacity-40';
      badgeStyle = 'bg-white/5 text-slate-400 border-white/5';
      textStyle = 'text-slate-400';
    }
  }

  // Bengali numerals mapping for option keys if in BN
  const displayKey = isBn ? (optionKey === 'A' ? 'ক' : optionKey === 'B' ? 'খ' : optionKey === 'C' ? 'গ' : 'ঘ') : optionKey;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onSelect}
        disabled={hasSubmitted}
        className={`group relative flex w-full items-start gap-3.5 sm:gap-4 rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 backdrop-blur-md min-h-[58px] ${borderStyle} ${
          !hasSubmitted ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
        }`}
      >
        <span
          className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border text-base sm:text-lg font-bold tracking-wider transition-colors duration-200 ${
            isBn ? 'font-bengali' : 'font-mono'
          } ${badgeStyle}`}
        >
          {displayKey}
        </span>

        <div className={`flex-1 pt-0.5 text-base sm:text-lg leading-relaxed ${textStyle}`}>
          <MathText content={text} />
        </div>

        {hasSubmitted && (
          <div className="flex shrink-0 items-center pt-1.5">
            {isCorrectOption ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 animate-in fade-in zoom-in duration-200" />
            ) : isSelected ? (
              <XCircle className="h-6 w-6 text-rose-400 animate-in fade-in zoom-in duration-200" />
            ) : null}
          </div>
        )}
      </button>

      {/* Inline Distractor Analysis Drawer */}
      <AnimatePresence>
        {showExplanation && diagnostic && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
            <div
              className={`rounded-xl border px-4 py-3 text-sm sm:text-base backdrop-blur-sm ${
                diagnostic.status === 'CORRECT'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-100'
              }`}
            >
              <div className="flex items-center gap-2 font-medium tracking-wide mb-1.5">
                {diagnostic.status === 'CORRECT' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 font-semibold uppercase text-xs sm:text-sm">
                      {t.explain.correctLogic}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-amber-400 font-semibold uppercase text-xs sm:text-sm">
                      {t.explain.trapDiagnosis}
                    </span>
                  </>
                )}
              </div>
              <div className="pl-6 text-sm sm:text-base leading-relaxed">
                <MathText content={diagnostic.verdict} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
