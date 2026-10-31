'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  content: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ content, className = '' }) => {
  // O(N) check: If no math delimiters exist, render plain string directly with zero KaTeX compute
  const hasMath = content.includes('$');

  const renderedElements = useMemo(() => {
    if (!hasMath) {
      return content;
    }

    const parts = content.split('$');
    return parts.map((part, index) => {
      // Even indexes are plain text, odd indexes are math formulas
      if (index % 2 === 0) {
        return <span key={index}>{part}</span>;
      }

      try {
        const html = katex.renderToString(part, {
          throwOnError: false,
          displayMode: false,
        });
        return (
          <span
            key={index}
            className="inline-block px-1 align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return (
          <code key={index} className="font-mono text-indigo-300">
            ${part}$
          </code>
        );
      }
    });
  }, [content, hasMath]);

  return <div className={`leading-relaxed ${className}`}>{renderedElements}</div>;
};

