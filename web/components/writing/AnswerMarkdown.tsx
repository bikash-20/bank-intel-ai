'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Check, Copy } from 'lucide-react';

interface AnswerMarkdownProps {
  content: string;
  className?: string;
}

// Sanitization schema allowing KaTeX elements, classes, and styles
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'style'],
    annotation: ['encoding'],
    code: ['className'],
    span: [
      ...(defaultSchema.attributes?.span || []),
      'className',
      'style',
      'ariaHidden',
      'aria-hidden',
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'annotation',
  ],
};

function CodeBlock({
  language,
  value,
}: {
  language?: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  return (
    <div
      className="my-3 rounded-2xl border overflow-hidden transition-colors shadow-sm"
      style={{
        backgroundColor: 'var(--surface2)',
        borderColor: 'var(--line)',
      }}
    >
      {/* Code Header Bar: Language Badge & Copy Button */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b select-none"
        style={{
          borderColor: 'var(--line)',
          backgroundColor: 'var(--surface)',
        }}
      >
        <span
          className="text-xs font-semibold tracking-wider uppercase font-sans-app"
          style={{ color: 'var(--mute)' }}
        >
          {language || 'code'}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--surface2)',
            borderColor: 'var(--line)',
            color: copied ? 'var(--ok)' : 'var(--ink)',
          }}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[var(--ok)]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto text-[13px] sm:text-[14px] font-mono leading-relaxed text-[var(--ink)]">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export const AnswerMarkdown: React.FC<AnswerMarkdownProps> = ({
  content,
  className = '',
}) => {
  return (
    <div
      className={`answer-markdown font-sans-app leading-relaxed break-words min-w-0 text-[var(--ink)] ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeSanitize, sanitizeSchema]]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h2 className="font-serif-app text-lg sm:text-xl font-semibold mt-4 mb-2 text-[var(--brand)]">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif-app text-base sm:text-lg font-semibold mt-4 mb-2 text-[var(--ink)] pb-1 border-b border-[var(--line)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif-app text-sm sm:text-base font-semibold mt-3 mb-1.5 text-[var(--brand)]">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-serif-app text-xs sm:text-sm font-semibold mt-2 mb-1 text-[var(--ink)]">
              {children}
            </h4>
          ),

          // Paragraphs & Lists
          p: ({ children }) => (
            <p className="text-sm sm:text-[15px] leading-relaxed my-2 text-[var(--ink)]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2 space-y-1 text-sm sm:text-[15px] text-[var(--ink)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1 text-sm sm:text-[15px] text-[var(--ink)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote
              className="my-3 pl-4 border-l-4 py-2 px-3 rounded-r-2xl italic text-xs sm:text-sm"
              style={{
                borderColor: 'var(--brand)',
                backgroundColor: 'var(--surface2)',
                color: 'var(--ink)',
              }}
            >
              {children}
            </blockquote>
          ),

          // Tables (GFM)
          table: ({ children }) => (
            <div
              className="my-4 w-full overflow-x-auto rounded-2xl border shadow-sm"
              style={{ borderColor: 'var(--line)' }}
            >
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[420px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead
              className="border-b font-semibold"
              style={{
                backgroundColor: 'var(--surface2)',
                borderColor: 'var(--line)',
                color: 'var(--ink)',
              }}
            >
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="p-2.5 sm:p-3 font-semibold whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td
              className="p-2.5 sm:p-3 border-b text-xs sm:text-sm leading-relaxed"
              style={{ borderColor: 'var(--line)' }}
            >
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr
              className="even:opacity-95 transition-colors"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              {children}
            </tr>
          ),

          // Code blocks & inline code
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const rawCode = String(children).replace(/\n$/, '');

            // Fenced code block (inside pre or with language)
            if (match || rawCode.includes('\n')) {
              return <CodeBlock language={match?.[1]} value={rawCode} />;
            }

            // Inline code
            return (
              <code
                className="px-1.5 py-0.5 rounded-md font-mono text-xs border"
                style={{
                  backgroundColor: 'var(--surface2)',
                  borderColor: 'var(--line)',
                  color: 'var(--brand)',
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

