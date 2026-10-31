import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import {
  computeQuestionHash,
  mapSubject,
  normalizeWhitespace,
  sanitizeMath,
  cleanText,
} from '../normalizer.js';
import type {
  ExamAppearance,
  ExamBody,
  Faculty,
  OptionKey,
  QuestionItem,
  SubjectCode,
  AIExplanationPayload,
} from '../../web/lib/types.js';

interface ExamTarget {
  id: string;
  title: string;
  examBody: ExamBody;
  post: string;
  year: number;
  faculty: Faculty;
  baseUrl: string;
  maxPages?: number;
}

const TARGETS: ExamTarget[] = [
  {
    id: 'bb-ad-2026',
    title: 'Bangladesh Bank Assistant Director 2026',
    examBody: 'BB',
    post: 'Assistant Director',
    year: 2026,
    faculty: 'BIBM',
    baseUrl:
      'https://sattacademy.com/%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6-%E0%A6%AC%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%82%E0%A6%95-%E0%A6%B8%E0%A6%B9%E0%A6%95%E0%A6%BE%E0%A6%B0%E0%A7%80-%E0%A6%AA%E0%A6%B0%E0%A6%BF%E0%A6%9A%E0%A6%BE%E0%A6%B2%E0%A6%95/all/mcq-questions',
  },
  {
    id: 'bb-so-it-2026',
    title: 'Bangladesh Bank Senior Officer (IT) 2026',
    examBody: 'BB',
    post: 'Senior Officer (IT)',
    year: 2026,
    faculty: 'CTI',
    baseUrl:
      'https://sattacademy.com/%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6-%E0%A6%AC%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%82%E0%A6%95-%E0%A6%B8%E0%A6%BF%E0%A6%A8%E0%A6%BF%E0%A6%AF%E0%A6%BC%E0%A6%B0-%E0%A6%85%E0%A6%AB%E0%A6%BF%E0%A6%B8%E0%A6%BE%E0%A6%B0-%E0%A6%86%E0%A6%87%E0%A6%9F%E0%A6%BF-%E0%A6%9C%E0%A6%AC-%E0%A6%86%E0%A6%87%E0%A6%A1%E0%A6%BF-%E0%A7%A8%E0%A7%AB%E0%A7%A7%E0%A7%A6%E0%A7%AA/all/mcq-questions',
  },
  {
    id: 'bb-ad-2019',
    title: 'Bangladesh Bank Assistant Director 2019',
    examBody: 'BB',
    post: 'Assistant Director',
    year: 2019,
    faculty: 'DU_ARTS',
    baseUrl:
      'https://sattacademy.com/bangladesh-bank-assistant-director-19-04-2019/all/mcq-questions',
  },
  {
    id: 'bb-ad-2018',
    title: 'Bangladesh Bank Assistant Director 2018',
    examBody: 'BB',
    post: 'Assistant Director',
    year: 2018,
    faculty: 'IBA',
    baseUrl:
      'https://sattacademy.com/bangladesh-bank-assistant-director-general-27-07-2018/all/mcq-questions',
  },
  {
    id: 'bb-cash-2017',
    title: 'Bangladesh Bank Officer (Cash) 2017',
    examBody: 'BB',
    post: 'Officer (Cash)',
    year: 2017,
    faculty: 'BIBM',
    baseUrl:
      'https://sattacademy.com/bangladesh-bank-recruitment-test-of-cash-officer-examination-held-on-24022017/all/mcq-questions',
  },
];

const RAW_CACHE_DIR = path.resolve(process.cwd(), '../.private/raw-html');

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithCache(url: string): Promise<string> {
  if (!fs.existsSync(RAW_CACHE_DIR)) {
    fs.mkdirSync(RAW_CACHE_DIR, { recursive: true });
  }

  const cacheKey = computeQuestionHash(url) + '.html';
  const cachePath = path.join(RAW_CACHE_DIR, cacheKey);

  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf8');
  }

  // Rate-limiting: 1 req / 1.5s
  await sleep(1500);

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  const html = await res.text();
  fs.writeFileSync(cachePath, html, 'utf8');
  return html;
}

export async function crawlTarget(target: ExamTarget): Promise<QuestionItem[]> {
  console.log(`\n=== Crawling Target: ${target.title} (${target.id}) ===`);
  const initialHtml = await fetchPageWithCache(target.baseUrl);
  const $init = cheerio.load(initialHtml);

  let lastPage = 1;
  const lastPageInput = $init('input[name="last_page"]').val();
  if (lastPageInput && !isNaN(Number(lastPageInput))) {
    lastPage = Number(lastPageInput);
  } else {
    // Check pagination link max
    $init('.pagination a').each((_, a) => {
      const match = $init(a).attr('href')?.match(/page=(\d+)/);
      if (match) {
        const p = parseInt(match[1], 10);
        if (p > lastPage) lastPage = p;
      }
    });
  }

  if (target.maxPages && target.maxPages < lastPage) {
    lastPage = target.maxPages;
  }

  console.log(`Found ${lastPage} pages to crawl for ${target.id}`);

  const questions: QuestionItem[] = [];
  const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];

  for (let page = 1; page <= lastPage; page++) {
    const pageUrl = page === 1 ? target.baseUrl : `${target.baseUrl}?page=${page}`;
    process.stdout.write(`Fetching page ${page}/${lastPage}... `);

    try {
      const html = await fetchPageWithCache(pageUrl);
      const $ = cheerio.load(html);

      const cards = $('.card-bordered');
      process.stdout.write(`Found ${cards.length} cards\n`);

      cards.each((cardIdx, card) => {
        const questionSpan = $(card).find('.question-span');
        const rawStemHtml = questionSpan.html() || '';
        const rawStemText = cleanText(questionSpan.text());

        if (!rawStemText || rawStemText.length < 5) return;

        // Subject detection
        const subjectHeader = $(card).closest('.card.bg-light').find('h3 a').text().trim();
        const subjectMapped = mapSubject(subjectHeader, rawStemText);
        if (subjectMapped === 'BANGLA_SKIP') {
          return; // Skip Bengali literature for Phase 1
        }

        // Correct Option
        let correctOption: OptionKey | null = null;
        const answerVal = $(card).find('.test-mode-data input[name="answer"]').val();
        if (answerVal && !isNaN(Number(answerVal))) {
          const idx = Number(answerVal) - 1;
          if (idx >= 0 && idx < 4) {
            correctOption = optionKeys[idx];
          }
        }

        // Options extraction
        const optionRecord: Partial<Record<OptionKey, string>> = {};
        const readingOptions = $(card).find('.reading-mode-data .row > div');

        readingOptions.slice(0, 4).each((optIdx, optDiv) => {
          const key = optionKeys[optIdx];
          const isCheckCircle = $(optDiv).find('.fa-check-circle').length > 0;
          if (isCheckCircle && !correctOption) {
            correctOption = key;
          }

          const optHtml = $(optDiv).find('label').html() || '';
          const optText = cleanText($(optDiv).find('label').text());
          const mathNorm = sanitizeMath(optHtml.includes('<sup') || optHtml.includes('<sub') ? optHtml : optText);
          optionRecord[key] = cleanText(mathNorm.text);
        });

        if (!correctOption) {
          correctOption = 'A'; // Safe fallback if unverified
        }

        // Validate all 4 options exist
        if (
          !optionRecord.A ||
          !optionRecord.B ||
          !optionRecord.C ||
          !optionRecord.D
        ) {
          // If fewer than 4 options extracted, fill or skip
          return;
        }

        const stemSanitized = sanitizeMath(
          rawStemHtml.includes('<sup') || rawStemHtml.includes('<sub') ? rawStemHtml : rawStemText
        );
        const finalStem = cleanText(stemSanitized.text);
        const hasMath =
          stemSanitized.hasMath ||
          Object.values(optionRecord).some((v) => v?.includes('$') || false);

        const questionHash = computeQuestionHash(finalStem);
        const qIndex = (page - 1) * 15 + cardIdx + 1;
        const questionId = `${target.id}-q${String(qIndex).padStart(3, '0')}`;

        const appearance: ExamAppearance = {
          examBody: target.examBody,
          post: target.post,
          year: target.year,
          faculty: target.faculty,
        };

        const item: QuestionItem = {
          id: questionId,
          hash: questionHash,
          subject: subjectMapped as SubjectCode,
          topic: getTopicForQuestion(subjectMapped as SubjectCode, finalStem),
          hasMath,
          stem: finalStem,
          options: optionRecord as Record<OptionKey, string>,
          correctOption,
          appearances: [appearance],
        };

        questions.push(item);
      });
    } catch (err: any) {
      console.error(`Error crawling page ${page}:`, err.message);
    }
  }

  console.log(`Successfully scraped ${questions.length} questions for ${target.id}`);
  return questions;
}

function getTopicForQuestion(subject: SubjectCode, stem: string): string {
  const s = stem.toLowerCase();
  switch (subject) {
    case 'MATH':
      if (s.includes('probability') || s.includes('dice') || s.includes('card')) return 'Probability';
      if (s.includes('profit') || s.includes('loss') || s.includes('selling') || s.includes('cost price')) return 'Profit & Loss';
      if (s.includes('interest') || s.includes('compound') || s.includes('annual')) return 'Simple & Compound Interest';
      if (s.includes('ratio') || s.includes('proportion')) return 'Ratio & Proportion';
      if (s.includes('speed') || s.includes('train') || s.includes('distance') || s.includes('time')) return 'Speed, Time & Distance';
      if (s.includes('work') || s.includes('pipe') || s.includes('cistern')) return 'Time & Work';
      if (s.includes('age') || s.includes('father') || s.includes('son')) return 'Problems on Ages';
      if (s.includes('triangle') || s.includes('rectangle') || s.includes('circle') || s.includes('perimeter')) return 'Geometry & Mensuration';
      return 'Arithmetic & Algebra';

    case 'ENGLISH':
      if (s.includes('synonym') || s.includes('closest in meaning')) return 'Synonyms';
      if (s.includes('antonym') || s.includes('opposite in meaning')) return 'Antonyms';
      if (s.includes('prefix') || s.includes('suffix')) return 'Prefix & Suffix';
      if (s.includes('preposition') || s.includes('appropriate preposition')) return 'Prepositions';
      if (s.includes('idiom') || s.includes('phrase')) return 'Idioms & Phrases';
      if (s.includes('spelling') || s.includes('correctly spelt')) return 'Spelling';
      return 'Grammar & Vocabulary';

    case 'ANALYTICAL':
      if (s.includes('rank') || s.includes('top') || s.includes('bottom')) return 'Ranking & Ordering';
      if (s.includes('seating') || s.includes('circle') || s.includes('row')) return 'Seating Arrangement';
      if (s.includes('pattern') || s.includes('series') || s.includes('next number')) return 'Number & Letter Series';
      if (s.includes('odd one out') || s.includes('does not belong')) return 'Classification / Odd One Out';
      if (s.includes('direction') || s.includes('north') || s.includes('east')) return 'Direction Sense';
      return 'Mental Ability & Logic';

    case 'COMPUTER_ICT':
      if (s.includes('ram') || s.includes('rom') || s.includes('cache') || s.includes('memory')) return 'Computer Memory';
      if (s.includes('network') || s.includes('ip') || s.includes('protocol') || s.includes('http')) return 'Networking & Internet';
      if (s.includes('operating system') || s.includes('linux') || s.includes('windows')) return 'Operating Systems';
      if (s.includes('database') || s.includes('sql') || s.includes('table')) return 'Database Systems';
      if (s.includes('software') || s.includes('compiler') || s.includes('interpreter')) return 'Software & Programming';
      return 'Computer Hardware & Fundamentals';

    case 'GENERAL_KNOWLEDGE':
      if (s.includes('bangladesh') || s.includes('liberation') || s.includes('padma') || s.includes('dhaka')) return 'Bangladesh Affairs';
      if (s.includes('un') || s.includes('treaty') || s.includes('country') || s.includes('capital') || s.includes('currency')) return 'International Affairs';
      if (s.includes('central bank') || s.includes('reserve') || s.includes('inflation') || s.includes('monetary policy')) return 'Banking & Economy';
      return 'General Science & Affairs';
  }
}

export async function runCrawlAll(): Promise<Record<string, QuestionItem[]>> {
  const result: Record<string, QuestionItem[]> = {};
  for (const target of TARGETS) {
    try {
      const qs = await crawlTarget(target);
      result[target.id] = qs;
    } catch (e: any) {
      console.error(`Error on target ${target.id}:`, e.message);
      result[target.id] = [];
    }
  }
  return result;
}

if (process.argv[1] && process.argv[1].endsWith('satt-bb.ts')) {
  runCrawlAll()
    .then((res) => {
      let total = 0;
      for (const [id, list] of Object.entries(res)) {
        console.log(`Target ${id}: ${list.length} questions`);
        total += list.length;
      }
      console.log(`Total questions crawled: ${total}`);
    })
    .catch(console.error);
}

