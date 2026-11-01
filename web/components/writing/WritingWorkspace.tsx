'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  Trash2,
  RefreshCw,
  BookOpen,
  Award,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { AnswerMarkdown } from './AnswerMarkdown';
import { useI18n } from '../../lib/i18n/context';
import type { WritingQuestion } from '../../lib/writing';

export interface WritingWorkspaceProps {
  questions: WritingQuestion[];
  workerUrl: string;
  examTitle?: string;
  examPost?: string;
}

interface AnswerState {
  loading: boolean;
  modelAnswer: string | null;
  generatedBy?: string;
  error: string | null;
}

function toBnDigits(num: number | string): string {
  const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => digits[parseInt(d, 10)] ?? d);
}

export const WritingWorkspace: React.FC<WritingWorkspaceProps> = ({
  questions,
  workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ||
    'https://bank-intel-worker.talukderbikash500.workers.dev',
  examTitle,
  examPost,
}) => {
  const { locale } = useI18n();
  const isBn = locale === 'bn';
  const num = (v: number | string) => (isBn ? toBnDigits(v) : String(v));

  // Local storage drafts state per questionId
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // AI answer states per questionId
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});

  // In-flight abort controllers per questionId
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Debounce timers for drafts
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize cached drafts and answers from localStorage on mount
  useEffect(() => {
    const initialDrafts: Record<string, string> = {};
    const initialAnswers: Record<string, AnswerState> = {};

    questions.forEach((q) => {
      try {
        const savedDraft = window.localStorage.getItem(`writing_draft_${q.id}`);
        if (savedDraft) initialDrafts[q.id] = savedDraft;

        const savedAnswer = window.localStorage.getItem(`writing_ans_${q.id}`);
        const savedMeta = window.localStorage.getItem(`writing_meta_${q.id}`);
        if (savedAnswer) {
          initialAnswers[q.id] = {
            loading: false,
            modelAnswer: savedAnswer,
            generatedBy: savedMeta || 'edge-cache',
            error: null,
          };
        }
      } catch {
        // Ignore localStorage read errors
      }
    });

    setDrafts(initialDrafts);
    setAnswers(initialAnswers);

    const abortMap = abortControllersRef.current;
    return () => {
      // Abort any pending requests on unmount
      abortMap.forEach((controller) => controller.abort());
    };
  }, [questions]);

  const handleDraftChange = (questionId: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [questionId]: text }));

    // Debounced autosave to localStorage
    const existingTimer = debounceTimersRef.current.get(questionId);
    if (existingTimer) clearTimeout(existingTimer);

    const newTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(`writing_draft_${questionId}`, text);
      } catch {
        // Ignore write failures
      }
    }, 300);

    debounceTimersRef.current.set(questionId, newTimer);
  };

  const handleClearDraft = (questionId: string) => {
    setDrafts((prev) => ({ ...prev, [questionId]: '' }));
    try {
      window.localStorage.removeItem(`writing_draft_${questionId}`);
    } catch {
      // Ignore removal failure
    }
  };

  const handleGenerateAnswer = useCallback(
    async (q: WritingQuestion) => {
      // Abort any existing in-flight request for this question
      const existingController = abortControllersRef.current.get(q.id);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      abortControllersRef.current.set(q.id, controller);

      setAnswers((prev) => ({
        ...prev,
        [q.id]: {
          loading: true,
          modelAnswer: prev[q.id]?.modelAnswer || null,
          generatedBy: prev[q.id]?.generatedBy,
          error: null,
        },
      }));

      try {
        const targetUrl = `${workerUrl.replace(/\/$/, '')}/api/v1/explain-writing`;
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: q.id,
            category: q.category,
            stem: q.stem,
            marks: q.marks,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(
            res.status === 429
              ? isBn
                ? 'অনুরোধের সীমা অতিক্রান্ত হয়েছে। অনুগ্রহ করে কিছুক্ষণের মধ্যে আবার চেষ্টা করুন।'
                : 'Rate limit exceeded. Please wait a moment and try again.'
              : isBn
              ? `সার্ভার ত্রুটি (HTTP ${res.status})`
              : `Server error: HTTP ${res.status}`
          );
        }

        const json = await res.json();
        if (json.ok === false) {
          throw new Error(json.error || 'Failed to generate answer');
        }

        const modelAnswer: string = json.modelAnswer || json.data?.modelAnswer || '';
        const generatedBy: string = json.generatedBy || 'Workers AI';

        if (!modelAnswer) {
          throw new Error('Received empty response from edge AI model.');
        }

        // Cache in localStorage
        try {
          window.localStorage.setItem(`writing_ans_${q.id}`, modelAnswer);
          window.localStorage.setItem(`writing_meta_${q.id}`, generatedBy);
        } catch {
          // Ignore write failure
        }

        setAnswers((prev) => ({
          ...prev,
          [q.id]: {
            loading: false,
            modelAnswer,
            generatedBy,
            error: null,
          },
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        console.error(`Failed to generate writing answer for ${q.id}:`, err);
        setAnswers((prev) => ({
          ...prev,
          [q.id]: {
            loading: false,
            modelAnswer: prev[q.id]?.modelAnswer || null,
            generatedBy: prev[q.id]?.generatedBy,
            error:
              err?.message ||
              (isBn
                ? 'মডেল উত্তর লোড করা সম্ভব হয়নি। সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।'
                : 'Network error: could not connect to edge AI. Please retry.'),
          },
        }));
      } finally {
        abortControllersRef.current.delete(q.id);
      }
    },
    [workerUrl, isBn]
  );

  return (
    <div className="space-y-6">
      {/* Top Banner: Subjective & Descriptive Writing Practice */}
      <section
        className="rounded-[28px] sm:rounded-[36px] border p-5 sm:p-7 transition-colors shadow-sm"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border"
                style={{
                  backgroundColor: 'var(--surface2)',
                  borderColor: 'var(--line)',
                  color: 'var(--brand)',
                }}
              >
                {examTitle || (isBn ? 'লিখিত প্রশ্নব্যাংক' : 'Written Question Bank')}
              </span>
              {examPost && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                    color: 'var(--mute)',
                  }}
                >
                  {examPost}
                </span>
              )}
            </div>

            <h2 className="font-serif-app text-xl sm:text-2xl font-semibold tracking-tight text-[var(--ink)]">
              {isBn
                ? 'বিষয়ভিত্তিক ও বর্ণনামূলক লিখিত অনুশীলন'
                : 'Subjective & Descriptive Writing Practice'}
            </h2>

            <p className="text-xs sm:text-sm font-sans-app leading-relaxed text-[var(--mute)]">
              {isBn
                ? 'বাংলাদেশ ব্যাংক ও বিসিএস লিখিত পরীক্ষার প্রশ্নের জন্য পরীক্ষার হল স্ট্যান্ডার্ড মডেল উত্তর এবং সেলফ ড্রাফটিং স্পেস।'
                : 'Standard examiner-grade answers with structured tables, formulas, and draft workspace for BB & BCS written exams.'}
            </p>
          </div>

          <div
            className="self-start sm:self-center shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold border flex items-center gap-1.5 shadow-sm"
            style={{
              backgroundColor: 'var(--surface2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
            }}
          >
            <BookOpen className="h-4 w-4 text-[var(--brand)]" />
            <span>
              {num(questions.length)} {isBn ? 'টি লিখিত প্রশ্ন' : 'written questions'}
            </span>
          </div>
        </div>
      </section>

      {/* Question Cards List */}
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const isStemBn = /[\u0980-\u09FF]/.test(q.stem);
          const currentDraft = drafts[q.id] || '';
          const currentAnswerState = answers[q.id] || {
            loading: false,
            modelAnswer: null,
            error: null,
          };
          const wordsCount = currentDraft.trim()
            ? currentDraft.trim().split(/\s+/).length
            : 0;

          return (
            <article
              key={q.id}
              className="rounded-[28px] sm:rounded-[36px] border p-5 sm:p-7 space-y-5 transition-colors shadow-sm"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--line)',
                boxShadow: 'var(--shadow)',
              }}
            >
              {/* Question Header: Index, Category, Marks */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-serif-app font-semibold border"
                    style={{
                      backgroundColor: 'var(--surface2)',
                      borderColor: 'var(--line)',
                      color: 'var(--ink)',
                    }}
                  >
                    #{num(idx + 1)}
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold border truncate max-w-[240px] sm:max-w-none"
                    style={{
                      backgroundColor: 'var(--surface2)',
                      borderColor: 'var(--line)',
                      color: 'var(--brand)',
                    }}
                  >
                    {q.category}
                  </span>
                </div>

                <div
                  className="px-3.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 shadow-sm"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                    color: 'var(--ok)',
                  }}
                >
                  <Award className="h-3.5 w-3.5" />
                  <span>
                    {num(q.marks)} {isBn ? 'নম্বর' : 'Marks'}
                  </span>
                </div>
              </div>

              {/* Question Stem */}
              <div
                className={`text-base sm:text-[17px] font-medium leading-relaxed text-[var(--ink)] ${
                  isStemBn ? 'font-serif-app' : 'font-sans-app'
                }`}
              >
                {q.stem}
              </div>

              {/* Two-Pane Workspace: Left Draft, Right AI Model Answer */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                {/* Left Pane: Candidate Draft Workspace */}
                <div
                  className="flex flex-col rounded-2xl border p-4 sm:p-5 transition-colors"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3 select-none">
                    <label
                      htmlFor={`draft-textarea-${q.id}`}
                      className="text-xs sm:text-[13px] font-semibold text-[var(--ink)] flex items-center gap-1.5"
                    >
                      <Layers className="h-3.5 w-3.5 text-[var(--brand)]" />
                      <span>{isBn ? 'আপনার লিখিত ড্রাফট' : 'Your Practice Draft'}</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-sans-app font-medium"
                        style={{ color: 'var(--mute)' }}
                      >
                        {num(wordsCount)} {isBn ? 'শব্দ' : 'words'}
                      </span>
                      {currentDraft && (
                        <button
                          type="button"
                          onClick={() => handleClearDraft(q.id)}
                          aria-label="Clear draft"
                          className="p-1 rounded-full hover:bg-[var(--line)] transition-colors text-[var(--mute)] hover:text-[var(--bad)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    id={`draft-textarea-${q.id}`}
                    rows={7}
                    value={currentDraft}
                    onChange={(e) => handleDraftChange(q.id, e.target.value)}
                    placeholder={
                      isBn
                        ? 'এখানে আপনার উত্তর বা প্রধান পয়েন্টগুলো ড্রাফট করুন (অটোসেভ হয়)...'
                        : 'Draft your answer, outline or key points here (autosaved to device)...'
                    }
                    className="w-full flex-1 p-3.5 rounded-xl border font-sans-app text-sm sm:text-[15px] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--line)',
                      color: 'var(--ink)',
                    }}
                  />
                </div>

                {/* Right Pane: Examiner-Standard AI Answer */}
                <div
                  className="flex flex-col rounded-2xl border p-4 sm:p-5 transition-colors relative"
                  style={{
                    backgroundColor: 'var(--surface2)',
                    borderColor: 'var(--line)',
                  }}
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between mb-3 select-none">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                      <span className="text-xs sm:text-[13px] font-semibold text-[var(--ink)]">
                        {isBn
                          ? 'পরীক্ষক-মান এআই মডেল উত্তর'
                          : 'Examiner-Standard AI Answer'}
                      </span>
                    </div>

                    {currentAnswerState.generatedBy && !currentAnswerState.loading && (
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full border truncate max-w-[150px]"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--line)',
                          color: 'var(--ok)',
                        }}
                      >
                        {currentAnswerState.generatedBy
                          .replace('workers-ai:', '')
                          .replace('openrouter-free:', '')
                          .replace('@cf/meta/', '')
                          .replace('@cf/mistralai/', '')}
                      </span>
                    )}
                  </div>

                  {/* Fixed-Height Scrollable Container with Soft Bottom Fade */}
                  <div className="relative flex-1 min-h-[220px]">
                    <div className="h-full max-h-[260px] sm:max-h-[320px] overflow-y-auto overscroll-contain pr-1 rounded-xl scrollbar-thin">
                      {/* State 1: Loading */}
                      {currentAnswerState.loading && (
                        <div
                          className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center space-y-3 font-sans-app"
                          style={{ color: 'var(--mute)' }}
                        >
                          <Loader2 className="h-7 w-7 animate-spin text-[var(--brand)]" />
                          <p className="text-xs sm:text-sm font-medium">
                            {isBn
                              ? 'বাংলাদেশ ব্যাংক ও বিসিএস লিখিত মানদণ্ড অনুযায়ী পূর্ণাঙ্গ মডেল উত্তর তৈরি হচ্ছে...'
                              : 'Analyzing exam rubric & generating examiner-grade answer...'}
                          </p>
                        </div>
                      )}

                      {/* State 2: Error */}
                      {currentAnswerState.error && !currentAnswerState.loading && (
                        <div
                          className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center space-y-3"
                          style={{ color: 'var(--bad)' }}
                        >
                          <AlertTriangle className="h-7 w-7" />
                          <p className="text-xs sm:text-sm font-medium">
                            {currentAnswerState.error}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleGenerateAnswer(q)}
                            className="px-4 py-1.5 rounded-full text-xs font-semibold border shadow-sm transition-all active:scale-95"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--bad)',
                              color: 'var(--bad)',
                            }}
                          >
                            {isBn ? 'পুনরায় চেষ্টা করুন' : 'Retry'}
                          </button>
                        </div>
                      )}

                      {/* State 3: Empty (Before Generation) */}
                      {!currentAnswerState.loading &&
                        !currentAnswerState.error &&
                        !currentAnswerState.modelAnswer && (
                          <div
                            className="h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center space-y-2.5 font-sans-app"
                            style={{ color: 'var(--mute)' }}
                          >
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center border shadow-sm"
                              style={{
                                backgroundColor: 'var(--surface)',
                                borderColor: 'var(--line)',
                                color: 'var(--brand)',
                              }}
                            >
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <p className="text-xs sm:text-sm font-medium">
                              {isBn
                                ? 'কাঠামোগত টেবিল, কোড ও পূর্ণাঙ্গ বিশ্লেষণ দেখতে নিচে "মডেল উত্তর তৈরি করুন" বাটনে ট্যাপ করুন।'
                                : 'Click "Generate AI Model Answer" below to produce an examiner-grade solution with structured tables & complexity analysis.'}
                            </p>
                          </div>
                        )}

                      {/* State 4: Generated Answer */}
                      {currentAnswerState.modelAnswer &&
                        !currentAnswerState.loading &&
                        !currentAnswerState.error && (
                          <div className="p-2 sm:p-3">
                            <AnswerMarkdown content={currentAnswerState.modelAnswer} />
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Action: Generate / Regenerate Button */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] select-none">
                <div
                  className="text-xs font-sans-app"
                  style={{ color: 'var(--mute)' }}
                >
                  {isBn
                    ? `${num(q.marks)} নম্বরের জন্য আনুমানিক ${num(q.marks >= 15 ? 450 : 300)} শব্দ`
                    : `Scaled for ${q.marks} marks (~${q.marks >= 15 ? '400-550' : '250-350'} words)`}
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateAnswer(q)}
                  disabled={currentAnswerState.loading}
                  className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  style={{
                    backgroundColor: 'var(--brand)',
                    color: 'var(--brand-ink)',
                  }}
                >
                  {currentAnswerState.loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{isBn ? 'বিশ্লেষণ চলছে...' : 'Generating...'}</span>
                    </>
                  ) : currentAnswerState.modelAnswer ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>{isBn ? 'পুনরায় তৈরি করুন' : 'Regenerate'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>{isBn ? 'মডেল উত্তর তৈরি করুন' : 'Generate AI Model Answer'}</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

