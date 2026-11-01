'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ChevronDown,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookOpen,
  Layers,
  X,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { MathText } from './MathText';
import { useI18n } from '../../lib/i18n/context';
import { getExplanationFromIDB, saveExplanationToIDB } from '../../lib/db/idb';
import type { AIExplanationPayload, OptionKey } from '../../lib/types';

interface AIExplainSectionProps {
  questionId: string;
  hash?: string;
  subject?: string;
  stem: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
  selectedOption: OptionKey | null;
  workerUrl?: string;
  onNext?: () => void;
}

// L1 In-Memory Client Cache for 0ms repeat toggles & prefetch deduplication
const clientExplanationCache = new Map<string, AIExplanationPayload>();
const inFlightRequests = new Map<string, Promise<AIExplanationPayload>>();

export function AIExplainSection({
  questionId,
  hash,
  subject,
  stem,
  options,
  correctOption,
  selectedOption,
  workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ||
    'https://bank-intel-worker.talukderbikash500.workers.dev',
  onNext,
}: AIExplainSectionProps) {
  const { t, locale } = useI18n();
  const isBn = locale === 'bn';

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanationPayload | null>(() => {
    return clientExplanationCache.get(questionId) ?? null;
  });
  const [error, setError] = useState<string | null>(null);

  // Sync state on question navigation
  useEffect(() => {
    setIsOpen(false);
    setError(null);
    const cached = clientExplanationCache.get(questionId) ?? null;
    setExplanation(cached);

    if (!cached) {
      getExplanationFromIDB(questionId)
        .then((idbHit) => {
          if (
            idbHit &&
            !idbHit.generatedBy?.includes('deterministic') &&
            !idbHit.generatedBy?.includes('static')
          ) {
            clientExplanationCache.set(questionId, idbHit);
            setExplanation(idbHit);
          }
        })
        .catch(() => {});
    }
  }, [questionId]);

  // Lock body scroll when modal sheet is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const fetchExplanation = useCallback(async (): Promise<AIExplanationPayload | null> => {
    // 1. Check L1 Memory Cache
    const memCached = clientExplanationCache.get(questionId);
    if (
      memCached &&
      !memCached.generatedBy?.includes('deterministic') &&
      !memCached.generatedBy?.includes('static')
    ) {
      setExplanation(memCached);
      return memCached;
    }

    // 2. Check L2 IndexedDB
    try {
      const idbHit = await getExplanationFromIDB(questionId);
      if (
        idbHit &&
        !idbHit.generatedBy?.includes('deterministic') &&
        !idbHit.generatedBy?.includes('static')
      ) {
        clientExplanationCache.set(questionId, idbHit);
        setExplanation(idbHit);
        return idbHit;
      }
    } catch {
      // Ignore IDB errors
    }

    // 3. Deduplicate in-flight requests to Edge AI Backend
    let promise = inFlightRequests.get(questionId);
    if (!promise) {
      const targetUrl = `${workerUrl.replace(/\/$/, '')}/api/v1/explain`;
      promise = fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          hash: hash || questionId,
          subject,
          stem,
          options,
          correctOption,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Worker responded with HTTP ${res.status}`);
        const json = await res.json();
        const payload: AIExplanationPayload = json.data ?? json;
        clientExplanationCache.set(questionId, payload);
        saveExplanationToIDB(payload).catch(() => {});
        return payload;
      });
      inFlightRequests.set(questionId, promise);
    }

    try {
      setLoading(true);
      setError(null);
      const data = await promise;
      setExplanation(data);
      return data;
    } catch (err: any) {
      console.error('Fetch explanation error:', err?.message);
      setError(
        isBn
          ? 'এআই ব্যাখ্যা লোড করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।'
          : 'Could not load AI explanation. Tap to retry.'
      );
      return null;
    } finally {
      inFlightRequests.delete(questionId);
      setLoading(false);
    }
  }, [questionId, hash, subject, stem, options, correctOption, workerUrl, isBn]);

  // Background prefetch upon option selection
  useEffect(() => {
    if (selectedOption !== null && !clientExplanationCache.has(questionId)) {
      void fetchExplanation();
    }
  }, [selectedOption, questionId, fetchExplanation]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (!explanation && !loading) {
      void fetchExplanation();
    }
  }, [explanation, loading, fetchExplanation]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Keyboard shortcut [E] to toggle, [Escape] to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev && !explanation && !loading) {
            void fetchExplanation();
          }
          return !prev;
        });
      }

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, explanation, loading, fetchExplanation]);

  const isAnswered = selectedOption !== null;
  const isUserCorrect = isAnswered && selectedOption === correctOption;

  const getOptionLabel = (key: OptionKey) => {
    if (!isBn) return key;
    return key === 'A' ? 'ক' : key === 'B' ? 'খ' : key === 'C' ? 'গ' : 'ঘ';
  };

  return (
    <div className="mt-4 w-full">
      {/* ALWAYS-VISIBLE AI EXPLAIN TOGGLE PILL */}
      <button
        type="button"
        onClick={handleOpen}
        className="group flex w-full items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 rounded-full border text-left transition-all duration-200 active:scale-[0.99] hover:border-[var(--brand)] shadow-sm"
        style={{
          backgroundColor: 'var(--surface2)',
          borderColor: 'var(--line)',
          color: 'var(--ink)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105"
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--brand)',
              border: '1px solid var(--line)',
            }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" />
            ) : (
              <Sparkles className="h-4 w-4 text-[var(--brand)]" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif-app font-semibold text-base sm:text-lg">
                {isBn ? 'এআই ব্যাখ্যা (AI Explain)' : 'AI Explain'}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: 'var(--surface)',
                  color: 'var(--mute)',
                  borderColor: 'var(--line)',
                }}
              >
                [E]
              </span>
              {explanation && !loading && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--okbg)',
                    color: 'var(--ok)',
                  }}
                >
                  {isBn ? 'প্রস্তুত' : 'Ready'}
                </span>
              )}
            </div>
            <p
              className="text-xs sm:text-[13px] font-sans-app leading-snug line-clamp-1 mt-0.5"
              style={{ color: 'var(--mute)' }}
            >
              {isAnswered
                ? isUserCorrect
                  ? isBn
                    ? 'পরীক্ষার হল শর্টকাট এবং অন্য অপশনগুলো কেন ফাঁদ তা দেখুন'
                    : 'Exam shortcut & why other options are traps'
                  : isBn
                  ? `আপনার নির্বাচিত অপশন [${getOptionLabel(selectedOption!)}] কেন ভুল এবং সঠিক সমাধানের ব্যাখ্যা`
                  : `Why Option [${selectedOption}] is a trap & step-by-step solution`
                : isBn
                ? 'মূল সূত্র, পরীক্ষার হলের শর্টকাট ও প্রতিটি অপশনের বিশ্লেষণ'
                : 'Core concept, shortcut & option-by-option diagnosis'}
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold shrink-0 pl-2"
          style={{ color: 'var(--brand)' }}
        >
          <span>{isBn ? 'ব্যাখ্যা দেখুন' : 'Explain'}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>

      {/* STICKY SCROLLABLE EXPLANATION SHEET (10/10 UX) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={handleClose}
          />

          {/* Modal / Slide-Up Sheet */}
          <div
            className="relative w-full max-w-3xl max-h-[92vh] sm:max-h-[86vh] rounded-t-[36px] sm:rounded-[36px] flex flex-col border shadow-2xl z-10 overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-250"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--line)',
              boxShadow: 'var(--shadow)',
              color: 'var(--ink)',
            }}
          >
            {/* Sticky Header */}
            <div
              className="sticky top-0 z-20 px-6 sm:px-8 py-4.5 border-b flex items-center justify-between backdrop-blur-xl transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: 'var(--brand)',
                    color: 'var(--brand-ink)',
                  }}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif-app text-lg sm:text-xl font-semibold">
                    {isBn ? 'এআই ব্যাখ্যা ও সমাধান' : 'AI Explanation & Diagnostics'}
                  </h3>
                  <p
                    className="text-xs font-sans-app mt-0.5"
                    style={{ color: 'var(--mute)' }}
                  >
                    {isBn
                      ? 'বাংলাদেশ ব্যাংক ও বিসিএস পরীক্ষার বিশ্লেষণ'
                      : 'Bangladesh Bank & BCS Pattern Analysis'}
                  </p>
                </div>
              </div>

              {/* Close Button and Esc Badge */}
              <div className="flex items-center gap-2">
                <span
                  className="hidden sm:inline-block px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                    color: 'var(--mute)',
                  }}
                >
                  Esc
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-10 w-10 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                  }}
                  aria-label="Close explanation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-6 sm:p-8 space-y-6">
              {/* Question Stem Card Reference */}
              <div
                className="p-4 sm:p-5 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--surface2)',
                  borderColor: 'var(--line)',
                }}
              >
                <div
                  className="text-xs font-semibold uppercase mb-1.5 flex items-center gap-1.5"
                  style={{ color: 'var(--mute)' }}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{isBn ? 'প্রশ্ন' : 'Question'}</span>
                </div>
                <div className="font-serif-app text-lg sm:text-xl font-medium leading-relaxed">
                  <MathText content={stem} />
                </div>
              </div>

              {/* Loading State */}
              {loading && !explanation && (
                <div
                  className="flex flex-col items-center justify-center py-16 space-y-3 font-sans-app"
                  style={{ color: 'var(--mute)' }}
                >
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
                  <span className="text-base font-medium">
                    {isBn
                      ? 'এআই মডেল ক্যাসকেড গভীর বিশ্লেষণ সম্পন্ন করছে...'
                      : 'Generating multi-model edge AI explanation...'}
                  </span>
                </div>
              )}

              {/* Error State */}
              {error && !explanation && (
                <div
                  className="p-5 rounded-2xl border flex items-center justify-between text-sm sm:text-base"
                  style={{
                    backgroundColor: 'var(--badbg)',
                    borderColor: 'var(--bad)',
                    color: 'var(--bad)',
                  }}
                >
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => void fetchExplanation()}
                    className="px-4 py-2 rounded-full font-semibold border text-xs sm:text-sm shadow-sm"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--bad)',
                      color: 'var(--bad)',
                    }}
                  >
                    {isBn ? 'পুনরায় চেষ্টা' : 'Retry'}
                  </button>
                </div>
              )}

              {/* Rich Explanation Content */}
              {explanation && (
                <>
                  {/* 1. Core Concept */}
                  <div
                    className="p-5 sm:p-6 rounded-3xl border transition-colors shadow-sm"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--line)',
                    }}
                  >
                    <div
                      className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--brand)' }}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>{t.explain.coreConcept}</span>
                    </div>
                    <div className="text-base sm:text-lg leading-relaxed font-sans-app">
                      <MathText content={explanation.coreConcept} />
                    </div>
                  </div>

                  {/* 2. 30-Second Exam Hall Shortcut */}
                  <div
                    className="p-5 sm:p-6 rounded-3xl border transition-colors shadow-sm"
                    style={{
                      backgroundColor: 'var(--surface2)',
                      borderColor: 'var(--ok)',
                    }}
                  >
                    <div
                      className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ok)' }}
                    >
                      <Zap className="h-4 w-4" />
                      <span>{t.explain.examShortcut}</span>
                    </div>
                    <div
                      className="text-base sm:text-lg leading-relaxed font-sans-app font-medium"
                      style={{ color: 'var(--ink)' }}
                    >
                      <MathText content={explanation.examHallShortcut} />
                    </div>
                  </div>

                  {/* 3. Step-by-Step Derivation */}
                  {explanation.stepByStep && (
                    <div
                      className="p-5 sm:p-6 rounded-3xl border transition-colors shadow-sm"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--line)',
                      }}
                    >
                      <div
                        className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--mute)' }}
                      >
                        <Layers className="h-4 w-4 text-[var(--brand)]" />
                        <span>{t.explain.stepByStep}</span>
                      </div>
                      <div className="whitespace-pre-line text-base leading-relaxed font-sans-app">
                        <MathText content={explanation.stepByStep} />
                      </div>
                    </div>
                  )}

                  {/* 4. Option Diagnostics Breakdown */}
                  <div className="space-y-3 pt-2">
                    <div
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--mute)' }}
                    >
                      {isBn
                        ? 'প্রতিটি অপশনের ফাঁদ ও সঠিক উত্তরের যুক্তি'
                        : 'Why Right vs. Why Wrong (Option Diagnostics)'}
                    </div>

                    {(['A', 'B', 'C', 'D'] as OptionKey[]).map((key) => {
                      const diag = explanation.optionDiagnostics?.[key];
                      const isCorrect = key === correctOption;
                      const isSelectedWrong = selectedOption === key && !isCorrect;
                      const displayKey = getOptionLabel(key);

                      let cardBg = 'var(--surface)';
                      let cardBorder = 'var(--line)';
                      let cardText = 'var(--ink)';

                      if (isCorrect) {
                        cardBg = 'var(--okbg)';
                        cardBorder = 'var(--ok)';
                        cardText = 'var(--ok)';
                      } else if (isSelectedWrong) {
                        cardBg = 'var(--badbg)';
                        cardBorder = 'var(--bad)';
                        cardText = 'var(--bad)';
                      }

                      return (
                        <div
                          key={key}
                          className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl border transition-all text-base"
                          style={{
                            backgroundColor: cardBg,
                            borderColor: cardBorder,
                            color: cardText,
                          }}
                        >
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif-app font-semibold text-base border"
                            style={{
                              backgroundColor: isCorrect
                                ? 'var(--ok)'
                                : isSelectedWrong
                                ? 'var(--bad)'
                                : 'var(--surface2)',
                              color: isCorrect || isSelectedWrong ? '#ffffff' : 'var(--ink)',
                              borderColor: 'transparent',
                            }}
                          >
                            {displayKey}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-semibold">
                              <span style={{ color: 'var(--ink)' }}>
                                <MathText content={options[key]} />
                              </span>
                              {isCorrect && (
                                <span
                                  className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold"
                                  style={{
                                    backgroundColor: 'var(--ok)',
                                    color: '#ffffff',
                                  }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{isBn ? 'সঠিক উত্তর' : 'Correct'}</span>
                                </span>
                              )}
                              {isSelectedWrong && (
                                <span
                                  className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold"
                                  style={{
                                    backgroundColor: 'var(--bad)',
                                    color: '#ffffff',
                                  }}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>{isBn ? 'আপনার পছন্দ (ফাঁদ)' : 'Trap Pick'}</span>
                                </span>
                              )}
                            </div>
                            <div
                              className="mt-2 text-sm sm:text-base leading-relaxed"
                              style={{ color: 'var(--ink)' }}
                            >
                              <MathText
                                content={
                                  diag?.verdict ||
                                  (isCorrect
                                    ? 'Matches the derived solution.'
                                    : 'Does not satisfy the conditions in the stem.')
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Model Telemetry */}
                  <div
                    className="flex items-center justify-between border-t pt-3.5 text-xs font-sans-app"
                    style={{
                      borderColor: 'var(--line)',
                      color: 'var(--mute)',
                    }}
                  >
                    <span>
                      Model:{' '}
                      {explanation.generatedBy
                        .replace('@cf/meta/', '')
                        .replace('@cf/mistralai/', '')
                        .replace('workers-ai:', '')}
                    </span>
                    <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                      {isBn ? '✓ লাইভ এজ এআই' : '✓ Live Edge AI'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Sticky Footer */}
            <div
              className="sticky bottom-0 z-20 px-6 sm:px-8 py-4 border-t flex items-center justify-between backdrop-blur-xl transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 rounded-full border text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--surface2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                }}
              >
                {isBn ? 'বন্ধ করুন' : 'Close'}
              </button>

              {onNext && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onNext();
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold shadow-md transition-all active:scale-95"
                  style={{
                    backgroundColor: 'var(--brand)',
                    color: 'var(--brand-ink)',
                  }}
                >
                  <span>{isBn ? 'পরবর্তী প্রশ্ন' : 'Next Question'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
