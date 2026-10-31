'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, BookOpen, Clock, Target, Layers } from 'lucide-react';
import { MathText } from './MathText';
import { useI18n } from '../../lib/i18n/context';
import type { AIExplanationPayload, OptionKey } from '../../lib/types';

interface AIExplainPanelProps {
  payload?: AIExplanationPayload;
  isLoading: boolean;
  error?: string;
  correctOption: OptionKey;
  onRetry?: () => void;
}

export const AIExplainPanel: React.FC<AIExplainPanelProps> = ({
  payload,
  isLoading,
  error,
  correctOption,
  onRetry,
}) => {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';
  const [activeTab, setActiveTab] = useState<OptionKey>(correctOption);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/25 p-6 backdrop-blur-md animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-6 w-6 rounded-full bg-indigo-500/40" />
          <div className="h-4 w-48 rounded bg-indigo-500/30" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-white/10" />
          <div className="h-4 w-5/6 rounded bg-white/10" />
          <div className="h-4 w-4/6 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 text-center">
        <p className="text-base text-rose-300 mb-3">{error || 'Could not load explanation.'}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-rose-500/20 px-5 py-2 text-sm font-medium text-rose-200 border border-rose-500/40 hover:bg-rose-500/30 transition-colors"
          >
            {t.explain.retry}
          </button>
        )}
      </div>
    );
  }

  const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];

  const getOptionLabel = (key: OptionKey) => {
    if (!isBn) return `[${key}]`;
    return key === 'A' ? '[ক]' : key === 'B' ? '[খ]' : key === 'C' ? '[গ]' : '[ঘ]';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-indigo-500/35 bg-gradient-to-b from-indigo-950/35 to-obsidian-900/80 p-5 sm:p-7 backdrop-blur-xl shadow-2xl relative overflow-hidden"
    >
      {/* Decorative corner glow */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <h4
            className={`font-bold text-base sm:text-lg text-slate-100 tracking-tight ${
              isBn ? 'font-bengali' : ''
            }`}
          >
            {t.explain.facultyTitle}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs text-indigo-300/90 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full">
          <Zap className="h-3.5 w-3.5" />
          <span>{payload.generatedBy.replace('@cf/meta/', '')}</span>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-5">
        {/* Core Concept */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-xs uppercase text-indigo-300 font-semibold mb-2">
            <BookOpen className="h-4 w-4" />
            <span className={isBn ? 'font-bengali font-bold' : 'font-mono'}>{t.explain.coreConcept}</span>
          </div>
          <div className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
            <MathText content={payload.coreConcept} />
          </div>
        </div>

        {/* 30-Second Exam Hall Shortcut */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 text-xs uppercase text-amber-400 font-bold mb-2">
            <Clock className="h-4 w-4 shrink-0" />
            <span className={isBn ? 'font-bengali font-bold' : 'font-mono'}>{t.explain.examShortcut}</span>
          </div>
          <div className="text-base sm:text-lg text-amber-100 font-medium leading-relaxed">
            <MathText content={payload.examHallShortcut} />
          </div>
        </div>

        {/* Step-by-Step Rationale */}
        {payload.stepByStep && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs uppercase text-cyan-300 font-semibold mb-2">
              <Layers className="h-4 w-4" />
              <span className={isBn ? 'font-bengali font-bold' : 'font-mono'}>{t.explain.stepByStep}</span>
            </div>
            <div className="text-sm sm:text-base text-slate-200 whitespace-pre-line leading-relaxed">
              <MathText content={payload.stepByStep} />
            </div>
          </div>
        )}

        {/* Option-by-Option Diagnostics Tabs */}
        <div className="pt-2">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-300 font-semibold mb-3">
            <Target className="h-4 w-4 text-indigo-400" />
            <span className={isBn ? 'font-bengali font-bold' : 'font-mono'}>{t.explain.optionDiagnostics}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {optionKeys.map((key) => {
              const diag = payload.optionDiagnostics?.[key];
              const isCorrect = diag?.status === 'CORRECT';
              const isActive = activeTab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-xs sm:text-sm transition-all duration-150 min-h-[50px] ${
                    isActive
                      ? isCorrect
                        ? 'border-emerald-500 bg-emerald-500/25 text-emerald-300 font-bold shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : 'border-amber-500 bg-amber-500/25 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <span className="text-base font-bold">{getOptionLabel(key)}</span>
                  <span className={`text-[11px] uppercase tracking-tight ${isBn ? 'font-bengali' : 'font-mono'}`}>
                    {isCorrect ? (isBn ? 'সঠিক' : 'Correct') : (isBn ? 'ফাঁদ' : 'Trap')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Diagnostic Detail */}
          {payload.optionDiagnostics?.[activeTab] && (
            <div
              className={`rounded-2xl border p-4 sm:p-5 text-sm sm:text-base ${
                payload.optionDiagnostics[activeTab].status === 'CORRECT'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-100'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold uppercase mb-2 flex items-center gap-2">
                <span className={isBn ? 'font-bengali' : 'font-mono'}>
                  {t.explain.diagnosticFor} {getOptionLabel(activeTab)} (
                  {payload.optionDiagnostics[activeTab].status === 'CORRECT'
                    ? t.explain.officialAnswer
                    : t.explain.distractorTrap}
                  ):
                </span>
              </div>
              <div className="leading-relaxed">
                <MathText content={payload.optionDiagnostics[activeTab].verdict} />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
