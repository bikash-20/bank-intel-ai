'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookOpen,
  Layers,
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

  const handleToggle = useCallback(() => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && !explanation && !loading) {
      void fetchExplanation();
    }
  }, [isOpen, explanation, loading, fetchExplanation]);

  // Keyboard shortcut [E]
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'e' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggle]);

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
        onClick={handleToggle}
        className="group flex w-full items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 rounded-full border text-left transition-all duration-200 active:scale-[0.99]"
        style={{
          backgroundColor: isOpen ? 'var(--surface2)' : 'var(--surface2)',
          borderColor: isOpen ? 'var(--brand)' : 'var(--line)',
          color: 'var(--ink)',
          boxShadow: isOpen ? 'var(--shadow)' : 'none',
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
          <span>
            {isOpen ? (isBn ? 'লুকান' : 'Hide') : (isBn ? 'ব্যাখ্যা দেখুন' : 'Explain')}
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* EXPANDABLE EXPLANATION DRAWER */}
      {isOpen && (
        <div
          className="mt-3.5 space-y-4 p-5 sm:p-7 rounded-[32px] border transition-colors shadow-lg"
          style={{
            backgroundColor: 'var(--surface2)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
          }}
        >
          {loading && !explanation && (
            <div
              className="flex items-center gap-3 py-8 justify-center font-sans-app"
              style={{ color: 'var(--mute)' }}
            >
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
              <span className="text-sm sm:text-base font-medium">
                {isBn
                  ? 'এআই মডেল ক্যাসকেড বিশ্লেষণ সম্পন্ন করছে...'
                  : 'Analyzing MCQ across Edge AI cascade...'}
              </span>
            </div>
          )}

          {error && !explanation && (
            <div
              className="flex items-center justify-between p-4 rounded-2xl border text-sm"
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
                className="px-3.5 py-1.5 rounded-full font-semibold border text-xs"
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

          {explanation && (
            <>
              {/* 1. Core Concept */}
              <div
                className="p-4 sm:p-5 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--line)',
                }}
              >
                <div
                  className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase"
                  style={{ color: 'var(--brand)' }}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>{t.explain.coreConcept}</span>
                </div>
                <div className="text-base sm:text-[17px] leading-relaxed font-sans-app font-normal">
                  <MathText content={explanation.coreConcept} />
                </div>
              </div>

              {/* 2. Exam Shortcut */}
              <div
                className="p-4 sm:p-5 rounded-2xl border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--line)',
                }}
              >
                <div
                  className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase"
                  style={{ color: 'var(--ok)' }}
                >
                  <Zap className="h-4 w-4" />
                  <span>{t.explain.examShortcut}</span>
                </div>
                <div
                  className="text-base sm:text-[17px] leading-relaxed font-sans-app font-medium"
                  style={{ color: 'var(--ink)' }}
                >
                  <MathText content={explanation.examHallShortcut} />
                </div>
              </div>

              {/* 3. Step-by-Step Derivation */}
              {explanation.stepByStep && (
                <div
                  className="p-4 sm:p-5 rounded-2xl border"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                  }}
                >
                  <div
                    className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase"
                    style={{ color: 'var(--mute)' }}
                  >
                    <Layers className="h-4 w-4 text-[var(--brand)]" />
                    <span>{t.explain.stepByStep}</span>
                  </div>
                  <div className="whitespace-pre-line text-sm sm:text-base leading-relaxed font-sans-app">
                    <MathText content={explanation.stepByStep} />
                  </div>
                </div>
              )}

              {/* 4. Option-by-Option Diagnostics */}
              <div className="space-y-2.5 pt-1">
                <div
                  className="text-xs font-semibold uppercase"
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

                  let pillBg = 'var(--surface)';
                  let pillBorder = 'var(--line)';
                  let pillText = 'var(--ink)';

                  if (isCorrect) {
                    pillBg = 'var(--okbg)';
                    pillBorder = 'var(--ok)';
                    pillText = 'var(--ok)';
                  } else if (isSelectedWrong) {
                    pillBg = 'var(--badbg)';
                    pillBorder = 'var(--bad)';
                    pillText = 'var(--bad)';
                  }

                  return (
                    <div
                      key={key}
                      className="flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all text-sm sm:text-base"
                      style={{
                        backgroundColor: pillBg,
                        borderColor: pillBorder,
                        color: pillText,
                      }}
                    >
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif-app font-semibold text-sm border"
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
                              <CheckCircle2 className="h-3 w-3" />
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
                              <AlertTriangle className="h-3 w-3" />
                              <span>{isBn ? 'আপনার পছন্দ (ফাঁদ)' : 'Trap Pick'}</span>
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-1.5 text-xs sm:text-sm leading-relaxed"
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

              {/* Model Telemetry Footer */}
              <div
                className="flex items-center justify-between border-t pt-3 text-[12px] font-sans-app"
                style={{
                  borderColor: 'var(--line)',
                  color: 'var(--mute)',
                }}
              >
                <span>
                  AI Model:{' '}
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
      )}
    </div>
  );
}
