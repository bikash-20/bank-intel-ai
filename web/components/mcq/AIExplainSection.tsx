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
  selectedOption: OptionKey | null; // null if unanswered, 'A'|'B'|'C'|'D' if answered
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

    // If not in L1 memory, check IndexedDB (filtering out any old deterministic fallbacks)
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
    // 1. Check L1 Memory Cache (validate real AI generation)
    const memCached = clientExplanationCache.get(questionId);
    if (
      memCached &&
      !memCached.generatedBy?.includes('deterministic') &&
      !memCached.generatedBy?.includes('static')
    ) {
      setExplanation(memCached);
      return memCached;
    }

    // 2. Check L2 IndexedDB (validate real AI generation)
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

    // 3. Deduplicate in-flight requests (e.g., background prefetch + user click)
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
        // Persist to IndexedDB asynchronously
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

  // BACKGROUND PREFETCH: As soon as user selects an answer (Right OR Wrong), prefetch explanation silently!
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

  // Keyboard shortcut [E] support
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
      {/* ALWAYS-VISIBLE AI EXPLAIN TOGGLE BAR DIRECTLY BELOW MCQ OPTIONS */}
      <button
        type="button"
        onClick={handleToggle}
        className={`group flex w-full items-center justify-between rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 backdrop-blur-md active:scale-[0.99] ${
          isOpen
            ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200 shadow-[0_0_20px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/30'
            : isAnswered
            ? 'border-indigo-500/35 bg-indigo-500/10 text-indigo-200 hover:border-indigo-400/60 hover:bg-indigo-500/20'
            : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-indigo-500/40 hover:bg-indigo-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shadow-sm">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-base sm:text-lg font-bold text-white tracking-tight ${isBn ? 'font-bengali' : ''}`}>
                {isBn ? 'এআই ব্যাখ্যা (AI Explain)' : '✦ AI Explain'}
              </span>
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                [E]
              </span>
              {explanation && !loading && (
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                  {isBn ? 'প্রস্তুত' : 'Ready'}
                </span>
              )}
            </div>
            <p className={`text-xs sm:text-sm text-slate-300/90 leading-snug line-clamp-1 mt-0.5 ${isBn ? 'font-bengali' : ''}`}>
              {isAnswered
                ? isUserCorrect
                  ? isBn
                    ? '৩০-সেকেন্ডের পরীক্ষার হল শর্টকাট এবং অন্য অপশনগুলো কেন ফাঁদ দেখুন'
                    : 'See the 30-second exam shortcut & why other options are traps'
                  : isBn
                  ? `আপনার নির্বাচিত অপশন [${getOptionLabel(selectedOption!)}] কেন ফাঁদ এবং কীভাবে সঠিক উত্তর বের করবেন দেখুন`
                  : `See why Option [${selectedOption}] is a trap & how to solve for Option [${correctOption}]`
                : isBn
                ? 'মূল সূত্র, পরীক্ষার হলের শর্টকাট ও প্রতিটি অপশনের বিশ্লেষণ দেখতে চাপুন'
                : 'Tap to reveal instant concept, shortcut & option-by-option breakdown'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-300 shrink-0 pl-2">
          <span className={isBn ? 'font-bengali text-sm' : ''}>
            {isOpen ? (isBn ? 'লুকান' : 'Hide') : (isBn ? 'ব্যাখ্যা দেখুন' : 'Explain')}
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* EXPANDABLE EXPLANATION DRAWER */}
      {isOpen && (
        <div className="mt-3.5 space-y-3.5 rounded-3xl border border-indigo-500/30 bg-[#090C15]/95 p-4 sm:p-6 text-sm sm:text-base text-slate-100 shadow-2xl backdrop-blur-xl">
          {loading && !explanation && (
            <div className="flex items-center gap-3 py-8 justify-center text-slate-300">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className={`text-sm sm:text-base font-medium ${isBn ? 'font-bengali' : ''}`}>
                {isBn
                  ? 'এআই মডেল ক্যাসকেড বিশ্লেষণ সম্পন্ন করছে...'
                  : 'Analyzing MCQ across Edge AI cascade...'}
              </span>
            </div>
          )}

          {error && !explanation && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void fetchExplanation()}
                className="rounded-xl bg-rose-500/25 px-3 py-1.5 font-bold text-rose-200 border border-rose-500/40 hover:bg-rose-500/35 transition-colors"
              >
                {isBn ? 'পুনরায় চেষ্টা' : 'Retry'}
              </button>
            </div>
          )}

          {explanation && (
            <>
              {/* 1. Core Concept */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="mb-1.5 flex items-center gap-2 text-xs uppercase font-bold text-indigo-400">
                  <BookOpen className="h-4 w-4" />
                  <span className={isBn ? 'font-bengali text-sm' : 'font-mono'}>
                    {t.explain.coreConcept}
                  </span>
                </div>
                <div className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
                  <MathText content={explanation.coreConcept} />
                </div>
              </div>

              {/* 2. 30-Second Exam Hall Shortcut */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 relative overflow-hidden">
                <div className="mb-1.5 flex items-center gap-2 text-xs uppercase font-bold text-amber-400">
                  <Zap className="h-4 w-4 shrink-0" />
                  <span className={isBn ? 'font-bengali text-sm' : 'font-mono'}>
                    {t.explain.examShortcut}
                  </span>
                </div>
                <div className="text-base sm:text-lg text-amber-100 font-medium leading-relaxed">
                  <MathText content={explanation.examHallShortcut} />
                </div>
              </div>

              {/* 3. Step-by-Step Derivation */}
              {explanation.stepByStep && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                  <div className="mb-1.5 flex items-center gap-2 text-xs uppercase font-bold text-slate-400">
                    <Layers className="h-4 w-4 text-cyan-400" />
                    <span className={isBn ? 'font-bengali text-sm' : 'font-mono'}>
                      {t.explain.stepByStep}
                    </span>
                  </div>
                  <div className="whitespace-pre-line text-sm sm:text-base text-slate-200 leading-relaxed">
                    <MathText content={explanation.stepByStep} />
                  </div>
                </div>
              )}

              {/* 4. Option-by-Option Right & Wrong Diagnostics */}
              <div className="space-y-2.5 pt-1">
                <div
                  className={`text-xs uppercase font-bold text-slate-400 ${
                    isBn ? 'font-bengali text-sm' : 'font-mono'
                  }`}
                >
                  {isBn
                    ? 'প্রতিটি অপশনের ফাঁদ ও সঠিক উত্তরের যুক্তি'
                    : 'Why Right vs. Why Wrong (Option Breakdown)'}
                </div>
                {(['A', 'B', 'C', 'D'] as OptionKey[]).map((key) => {
                  const diag = explanation.optionDiagnostics?.[key];
                  const isCorrect = key === correctOption;
                  const isSelectedWrong = selectedOption === key && !isCorrect;
                  const displayKey = getOptionLabel(key);

                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-sm sm:text-base transition-all ${
                        isCorrect
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                          : isSelectedWrong
                          ? 'border-rose-500/45 bg-rose-500/10 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30'
                          : 'border-white/10 bg-white/[0.02] text-slate-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                          isCorrect
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            : isSelectedWrong
                            ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                            : 'bg-white/10 text-slate-400 border border-white/10'
                        } ${isBn ? 'font-bengali text-base' : 'font-mono'}`}
                      >
                        {displayKey}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          <span className="text-white text-base">
                            <MathText content={options[key]} />
                          </span>
                          {isCorrect && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{isBn ? 'সঠিক উত্তর' : 'Correct Answer'}</span>
                            </span>
                          )}
                          {isSelectedWrong && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md border border-rose-500/30">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>{isBn ? 'আপনার পছন্দ (ফাঁদ)' : 'Your Pick (Trap)'}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                          <MathText
                            content={
                              diag?.verdict ||
                              (isCorrect
                                ? 'Matches the derived solution.'
                                : 'Does not satisfy the conditions in the question stem.')
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Model Telemetry Footer */}
              <div className="flex items-center justify-between border-t border-white/10 pt-2.5 font-mono text-[11px] text-slate-400">
                <span className="text-indigo-300 font-medium">
                  AI Model: {explanation.generatedBy.replace('@cf/meta/', '').replace('@cf/mistralai/', '').replace('workers-ai:', '')}
                </span>
                <span className="text-emerald-400 font-semibold">
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
