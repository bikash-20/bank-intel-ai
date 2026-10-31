'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  Trophy,
  ListOrdered,
} from 'lucide-react';
import { getMistakes, getAllQuestionsFromIDB, recordUserAttempt } from '../../lib/db/idb';
import { QuestionCard } from '../../components/mcq/QuestionCard';
import { DesktopNav } from '../../components/layout/DesktopNav';
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

  if (mistakes.length === 0) {
    return (
      <div className="space-y-6">
        <DesktopNav />
        <div
          className="max-w-2xl mx-auto filter-panel-rounded border p-8 sm:p-12 text-center space-y-4 shadow-xl transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center mx-auto shadow-sm"
            style={{
              backgroundColor: 'var(--okbg)',
              color: 'var(--ok)',
              border: '1px solid var(--ok)',
            }}
          >
            <Trophy className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <h2
            className="text-2xl sm:text-3xl font-serif-app font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            {t.vault.pristineTitle}
          </h2>
          <p
            className="text-sm sm:text-base font-sans-app max-w-md mx-auto leading-relaxed"
            style={{ color: 'var(--mute)' }}
          >
            {t.vault.pristineMsg}
          </p>
        </div>
      </div>
    );
  }

  const activeQuestion = activeQuestionId ? questionsMap.get(activeQuestionId) : null;
  const activeMistake = mistakes.find((m) => m.questionId === activeQuestionId);

  return (
    <div className="space-y-6">
      <DesktopNav />

      {/* Header Overview Banner */}
      <div
        className="filter-panel-rounded border p-5 sm:p-7 flex flex-wrap items-center justify-between gap-4 transition-colors"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold uppercase"
            style={{ color: 'var(--bad)' }}
          >
            <AlertOctagon className="h-4 w-4" />
            <span>{t.vault.tagline}</span>
          </div>
          <h2
            className="text-xl sm:text-2xl font-serif-app font-semibold mt-1"
            style={{ color: 'var(--ink)' }}
          >
            {t.vault.title} ({num(mistakes.length)})
          </h2>
          <p
            className="text-xs sm:text-sm font-sans-app mt-1 max-w-xl"
            style={{ color: 'var(--mute)' }}
          >
            {t.vault.graduationRule}
          </p>
        </div>

        {/* Progress Pill */}
        {activeMistake && (
          <div
            className="flex items-center gap-3 text-xs sm:text-sm border px-4 py-2 rounded-full font-sans-app"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            <div>
              <span style={{ color: 'var(--mute)' }}>{t.vault.failedCount}: </span>
              <span style={{ color: 'var(--bad)', fontWeight: 600 }}>
                {num(activeMistake.wrongCount)}x
              </span>
            </div>
            <span style={{ color: 'var(--mute)' }}>•</span>
            <div>
              <span style={{ color: 'var(--mute)' }}>{t.vault.streakProgress}: </span>
              <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                {num(activeMistake.correctStreak)} / {num(3)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Layout: Active Card + Revision Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              className="question-card-rounded border p-12 text-center"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
                color: 'var(--mute)',
              }}
            >
              {t.vault.emptySelection}
            </div>
          )}
        </div>

        {/* Revision Queue List */}
        <div
          className="filter-panel-rounded border p-5 space-y-3 h-fit max-h-[600px] overflow-y-auto transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          <div
            className="flex items-center justify-between text-xs font-semibold border-b pb-2.5"
            style={{ borderColor: 'var(--line)' }}
          >
            <span
              className="flex items-center gap-1.5 font-sans-app"
              style={{ color: 'var(--ink)' }}
            >
              <ListOrdered className="h-4 w-4 text-[var(--brand)]" />
              <span>{t.vault.queueTitle}</span>
            </span>
            <span style={{ color: 'var(--mute)' }}>
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
                  className="w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99]"
                  style={{
                    backgroundColor: isActive ? 'var(--surface2)' : 'var(--surface)',
                    borderColor: isActive ? 'var(--brand)' : 'var(--line)',
                    color: 'var(--ink)',
                  }}
                >
                  <div
                    className="flex items-center justify-between text-xs font-sans-app mb-1.5"
                    style={{ color: 'var(--mute)' }}
                  >
                    <span>{t.vault.item} #{num(idx + 1)}</span>
                    <span
                      style={{
                        color: m.correctStreak > 0 ? 'var(--ok)' : 'var(--bad)',
                        fontWeight: 600,
                      }}
                    >
                      {num(m.correctStreak)}/{num(3)} {isBn ? 'স্ট্রাইক' : 'Streak'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm line-clamp-2 leading-relaxed font-sans-app">
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
