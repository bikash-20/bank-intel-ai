'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  Trophy,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';
import { getMistakes, getAllQuestionsFromIDB, recordUserAttempt } from '../../lib/db/idb';
import { QuestionCard } from '../../components/mcq/QuestionCard';
import { useI18n } from '../../lib/i18n/context';
import type { MistakeItem, QuestionItem, UserAttempt } from '../../lib/types';

function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)] ?? d);
}

export default function MistakeVaultPage() {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Map<string, QuestionItem>>(new Map());
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  const loadVault = useCallback(async () => {
    setIsLoading(true);
    try {
      let mList: MistakeItem[] = [];
      let qList: QuestionItem[] = [];
      try {
        [mList, qList] = await Promise.all([getMistakes(), getAllQuestionsFromIDB()]);
      } catch (e) {
        console.warn('IDB read error:', e);
      }

      const map = new Map<string, QuestionItem>();
      for (const q of qList) {
        map.set(q.id, q);
      }
      setQuestionsMap(map);
      setMistakes(mList);
      if (mList.length > 0 && !activeQuestionId) {
        setActiveQuestionId(mList[0].questionId);
      }
    } catch (err: any) {
      console.error('Failed to load mistake vault:', err?.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeQuestionId]);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const handleAnswerAttempt = async (attempt: UserAttempt) => {
    try {
      await recordUserAttempt(attempt);
    } catch (e) {
      console.warn('IDB write error:', e);
    }
    await loadVault();
  };

  if (isLoading) {
    return (
      <div className="glass-panel rounded-3xl p-12 text-center animate-pulse border border-white/10">
        <div className="h-6 w-48 rounded bg-white/10 mx-auto mb-4" />
        <div className="h-4 w-64 rounded bg-white/10 mx-auto" />
      </div>
    );
  }

  if (mistakes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-8 sm:p-12 text-center space-y-4 border border-white/10 shadow-2xl">
        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.25)]">
          <Trophy className="h-8 w-8 sm:h-10 sm:w-10" />
        </div>
        <h2
          className={`text-2xl sm:text-3xl font-bold text-white ${
            isBn ? 'font-bengali' : 'font-display'
          }`}
        >
          {t.vault.pristineTitle}
        </h2>
        <p
          className={`text-sm sm:text-base text-slate-300 max-w-md mx-auto leading-relaxed ${
            isBn ? 'font-bengali' : ''
          }`}
        >
          {t.vault.pristineMsg}
        </p>
      </div>
    );
  }

  const activeQuestion = activeQuestionId ? questionsMap.get(activeQuestionId) : null;
  const activeMistake = mistakes.find((m) => m.questionId === activeQuestionId);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Overview Banner */}
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase tracking-wider font-semibold">
            <AlertOctagon className="h-4 w-4" />
            <span className={isBn ? 'font-bengali text-sm' : ''}>{t.vault.tagline}</span>
          </div>
          <h2
            className={`text-xl sm:text-2xl font-bold text-white mt-1 ${
              isBn ? 'font-bengali text-2xl' : 'font-display'
            }`}
          >
            {t.vault.title} ({num(mistakes.length)})
          </h2>
          <p
            className={`text-xs sm:text-sm text-slate-400 mt-1 max-w-xl ${
              isBn ? 'font-bengali text-sm' : 'font-mono'
            }`}
          >
            {t.vault.graduationRule}
          </p>
        </div>

        {/* Active Item Graduation Progress Pill */}
        {activeMistake && (
          <div className="flex items-center gap-3 font-mono text-xs sm:text-sm bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl shadow-sm">
            <div>
              <span className={`text-slate-400 ${isBn ? 'font-bengali' : ''}`}>
                {t.vault.failedCount}:{' '}
              </span>
              <span className="text-rose-400 font-bold tabular-nums">
                {num(activeMistake.wrongCount)}x
              </span>
            </div>
            <span className="text-white/20">•</span>
            <div>
              <span className={`text-slate-400 ${isBn ? 'font-bengali' : ''}`}>
                {t.vault.streakProgress}:{' '}
              </span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {num(activeMistake.correctStreak)} / {num(3)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Layout: Question Card + Responsive Revision Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Active MCQ Driller */}
        <div className="lg:col-span-2">
          {activeQuestion ? (
            <QuestionCard
              key={activeQuestion.id}
              question={activeQuestion}
              questionNumber={
                mistakes.findIndex((m) => m.questionId === activeQuestion.id) + 1
              }
              totalQuestions={mistakes.length}
              mode="PRACTICE"
              isBookmarked={true}
              onAnswerSelected={handleAnswerAttempt}
            />
          ) : (
            <div
              className={`glass-panel rounded-2xl p-8 sm:p-12 text-center text-slate-400 border border-white/10 ${
                isBn ? 'font-bengali text-base' : ''
              }`}
            >
              {t.vault.emptySelection}
            </div>
          )}
        </div>

        {/* Revision Queue List (Responsive) */}
        <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3 h-fit max-h-[600px] overflow-y-auto border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold border-b border-white/10 pb-2.5">
            <span className={`flex items-center gap-1.5 ${isBn ? 'font-bengali text-sm text-slate-300' : 'font-mono uppercase'}`}>
              <ListOrdered className="h-4 w-4 text-indigo-400" />
              <span>{t.vault.queueTitle}</span>
            </span>
            <span className="font-mono text-slate-400">
              {num(mistakes.length)}
            </span>
          </div>

          <div className="space-y-2">
            {mistakes.map((m, idx) => {
              const q = questionsMap.get(m.questionId);
              const isActive = activeQuestionId === m.questionId;

              return (
                <button
                  key={m.questionId}
                  type="button"
                  onClick={() => setActiveQuestionId(m.questionId)}
                  className={`w-full text-left p-3 sm:p-3.5 rounded-xl border transition-all active:scale-[0.99] ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500/25 text-white shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                      : 'border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                    <span className={isBn ? 'font-bengali' : ''}>
                      {t.vault.item} #{num(idx + 1)}
                    </span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {num(m.correctStreak)}/{num(3)} {isBn ? 'স্ট্রাইক' : 'Streak'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 line-clamp-2 leading-relaxed">
                    {q?.stem || m.questionId}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
