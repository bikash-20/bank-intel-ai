import { createHash } from 'node:crypto';
import type { OptionKey, SubjectCode } from '../../web/lib/types.js';

export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

export function computeQuestionHash(stem: string): string {
  const normalized = normalizeWhitespace(stem.toLowerCase());
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function mapSubject(rawSubject: string, stem: string): SubjectCode | 'BANGLA_SKIP' {
  const sub = rawSubject.toLowerCase();
  if (sub.includes('বাংলা') || sub.includes('bangla') || sub.includes('bengali')) {
    return 'BANGLA_SKIP';
  }
  if (sub.includes('গণিত') || sub.includes('math') || sub.includes('arithmetic')) {
    return 'MATH';
  }
  if (sub.includes('english') || sub.includes('ইংরেজি')) {
    return 'ENGLISH';
  }
  if (
    sub.includes('মানসিক দক্ষতা') ||
    sub.includes('analytical') ||
    sub.includes('mental ability') ||
    sub.includes('যুক্তিমূলক')
  ) {
    return 'ANALYTICAL';
  }
  if (
    sub.includes('কম্পিউটার') ||
    sub.includes('আইসিটি') ||
    sub.includes('ict') ||
    sub.includes('computer') ||
    sub.includes('তথ্যপ্রযুক্তি')
  ) {
    return 'COMPUTER_ICT';
  }
  if (
    sub.includes('সাধারণ জ্ঞান') ||
    sub.includes('general knowledge') ||
    sub.includes('gk') ||
    sub.includes('বাংলাদেশ') ||
    sub.includes('আন্তর্জাতিক')
  ) {
    return 'GENERAL_KNOWLEDGE';
  }

  // Fallback by heuristic on stem
  const lowerStem = stem.toLowerCase();
  // Check if stem is purely Bengali literature
  if (/[\u0980-\u09FF]/.test(stem) && !/[a-zA-Z]/.test(stem)) {
    // If predominantly Bengali without English, skip in Phase 1
    return 'BANGLA_SKIP';
  }

  if (
    /calculate|sum of|ratio|percent|perimeter|triangle|probability|dice|speed|interest|compound|equation|solve for/i.test(
      lowerStem
    )
  ) {
    return 'MATH';
  }
  if (/synonym|antonym|spelling|preposition|idiom|clause|passive|verb|adjective|prefix|suffix/i.test(lowerStem)) {
    return 'ENGLISH';
  }
  if (/ram|rom|cpu|byte|network|protocol|ip address|operating system|software|hardware|cache|database/i.test(lowerStem)) {
    return 'COMPUTER_ICT';
  }
  if (/ranks|series|odd one out|pattern|sequence|seating arrangement|direction/i.test(lowerStem)) {
    return 'ANALYTICAL';
  }

  return 'GENERAL_KNOWLEDGE';
}

/**
 * Sanitizes math expressions:
 * Converts HTML sup/sub to LaTeX, normalizes unicode math operators,
 * and wraps standalone algebraic or mathematical expressions in single dollar signs ($...$).
 */
export function sanitizeMath(text: string): { text: string; hasMath: boolean } {
  if (!text) return { text: '', hasMath: false };

  let s = text;

  // 1. Convert HTML sup and sub tags
  s = s.replace(/<sup>(.*?)<\/sup>/gi, '^{$1}');
  s = s.replace(/<sub>(.*?)<\/sub>/gi, '_{$1}');

  // 2. Normalize Unicode fractions
  s = s.replace(/½/g, '\\frac{1}{2}');
  s = s.replace(/¼/g, '\\frac{1}{4}');
  s = s.replace(/¾/g, '\\frac{3}{4}');
  s = s.replace(/⅓/g, '\\frac{1}{3}');
  s = s.replace(/⅔/g, '\\frac{2}{3}');
  s = s.replace(/⅛/g, '\\frac{1}{8}');
  s = s.replace(/⅜/g, '\\frac{3}{8}');
  s = s.replace(/⅝/g, '\\frac{5}{8}');
  s = s.replace(/⅞/g, '\\frac{7}{8}');

  // 3. Normalize Unicode math symbols
  s = s.replace(/−/g, '-');
  s = s.replace(/×/g, '\\times ');
  s = s.replace(/÷/g, '\\div ');
  s = s.replace(/√(\d+|[a-zA-Z]+)/g, '\\sqrt{$1}');
  s = s.replace(/π/g, '\\pi ');
  s = s.replace(/≤/g, '\\le ');
  s = s.replace(/≥/g, '\\ge ');
  s = s.replace(/≠/g, '\\ne ');
  s = s.replace(/°/g, '^\\circ ');

  // 4. Wrap expressions with powers, fractions, square roots in $...$ if not already wrapped
  // Avoid double wrapping if already inside $...$
  const parts = s.split('$');
  // Even indexes (0, 2, 4...) are outside $, odd indexes (1, 3, 5...) are inside $
  for (let i = 0; i < parts.length; i += 2) {
    let segment = parts[i];

    // Detect patterns like \frac{...}{...} or \sqrt{...} or ^{...} or _{...}
    // and wrap the math token in $
    segment = segment.replace(/(\\frac\{[^{}]+\}\{[^{}]+\})/g, '$$$1$$');
    segment = segment.replace(/(\\sqrt\{[^{}]+\})/g, '$$$1$$');
    segment = segment.replace(/([a-zA-Z0-9]+(?:\^\{[^{}]+\}|_\{[^{}]+\})+)/g, '$$$1$$');

    // Detect simple arithmetic equations like: 3x + 2 = 702 or x^2 - y^2 = 0
    segment = segment.replace(/\b([a-zA-Z0-9]+(?:\s*[+\-*/=]\s*[a-zA-Z0-9]+){2,})\b/g, (match) => {
      // Don't wrap normal English phrases like "more than twice the"
      if (/[a-zA-Z]{3,}/.test(match)) return match;
      return `$${match}$`;
    });

    parts[i] = segment;
  }

  s = parts.join('$');

  // Fix any accidental nested $$...$$ to $...$
  s = s.replace(/\${2,}(.*?)\${2,}/g, '$$$1$$');

  // Verify dollar sign balancing
  const dollarCount = (s.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    // If unbalanced, strip single rogue dollar signs or balance
    s = s.replace(/\$/g, '');
  }

  const hasMath = (s.match(/\$/g) || []).length >= 2;
  return { text: normalizeWhitespace(s), hasMath };
}

export function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

