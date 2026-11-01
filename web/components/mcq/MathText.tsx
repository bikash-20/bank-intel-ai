'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  content: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ content, className = '' }) => {
  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Fast path: if no math delimiters exist, return plain text
    if (!content.includes('$') && !content.includes('\\(') && !content.includes('\\[')) {
      return content;
    }

    // Comprehensive regex for block math ($$...$$ or \[...\]) and inline math ($...$ or \(...\))
    const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    while ((match = regex.exec(content)) !== null) {
      // Push preceding plain text
      if (match.index > lastIndex) {
        elements.push(
          <span key={`text-${keyIdx++}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }

      const blockMath = match[1] || match[2];
      const inlineMath = match[3] || match[4];

      if (blockMath) {
        try {
          const html = katex.renderToString(blockMath.trim(), {
            throwOnError: false,
            displayMode: true,
            strict: false,
          });
          elements.push(
            <span
              key={`block-${keyIdx++}`}
              className="block my-2 overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          elements.push(
            <code key={`code-${keyIdx++}`} className="font-mono text-xs">
              $${blockMath}$$
            </code>
          );
        }
      } else if (inlineMath) {
        try {
          const html = katex.renderToString(inlineMath.trim(), {
            throwOnError: false,
            displayMode: false,
            strict: false,
          });
          elements.push(
            <span
              key={`inline-${keyIdx++}`}
              className="inline-block px-0.5 align-middle"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          elements.push(
            <code key={`code-${keyIdx++}`} className="font-mono text-xs">
              ${inlineMath}$
            </code>
          );
        }
      }

      lastIndex = regex.lastIndex;
    }

    // Push remaining trailing plain text
    if (lastIndex < content.length) {
      elements.push(
        <span key={`text-${keyIdx++}`}>
          {content.substring(lastIndex)}
        </span>
      );
    }

    return elements;
  }, [content]);

  return <div className={`leading-relaxed ${className}`}>{renderedElements}</div>;
};
