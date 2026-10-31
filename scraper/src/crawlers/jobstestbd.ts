import * as cheerio from 'cheerio';
import { computeQuestionHash, mapSubject, sanitizeMath, cleanText } from '../normalizer.js';
import type { QuestionItem, OptionKey, SubjectCode, ExamAppearance } from '../../web/lib/types.js';

export async function parseJobsTestBD(url: string, examMeta: { id: string; post: string; year: number; faculty: any }): Promise<QuestionItem[]> {
  console.log(`\nCrawling JobsTestBD: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove script and adsbygoogle tags
  $('script, ins, style, .adsbygoogle').remove();
  const rawText = $('.entry-content').text();

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const questions: QuestionItem[] = [];

  let currentStem = '';
  let currentOptions: Partial<Record<OptionKey, string>> = {};
  let currentAnswer: OptionKey | null = null;
  let currentSubject: SubjectCode = 'GENERAL_KNOWLEDGE';
  let qNum = 0;

  const flushQuestion = () => {
    if (currentStem && currentOptions.A && currentOptions.B && currentOptions.C && currentOptions.D && currentAnswer) {
      // Check if stem is Bengali Literature to skip for Phase 1
      const mapped = mapSubject(currentSubject, currentStem);
      if (mapped !== 'BANGLA_SKIP') {
        const mathCheck = sanitizeMath(currentStem);
        const finalStem = cleanText(mathCheck.text);
        const hasMath = mathCheck.hasMath || Object.values(currentOptions).some(o => o?.includes('$'));
        const hash = computeQuestionHash(finalStem);
        const questionId = `${examMeta.id}-q${String(qNum).padStart(3, '0')}`;

        const item: QuestionItem = {
          id: questionId,
          hash,
          subject: mapped,
          topic: currentSubject,
          hasMath,
          stem: finalStem,
          options: currentOptions as Record<OptionKey, string>,
          correctOption: currentAnswer,
          appearances: [{
            examBody: 'BB',
            post: examMeta.post,
            year: examMeta.year,
            faculty: examMeta.faculty
          }]
        };
        questions.push(item);
      }
    }
    currentStem = '';
    currentOptions = {};
    currentAnswer = null;
  };

  const optionRegex = /(?:([A-D]|ক|খ|গ|ঘ)[\)\.\s]+)(.*?)(?=(?:[A-D]|ক|খ|গ|ঘ)[\)\.\s]+|$)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers
    if (line.includes('ইংরেজি') || line.includes('English')) currentSubject = 'ENGLISH';
    else if (line.includes('গণিত') || line.includes('Mathematics')) currentSubject = 'MATH';
    else if (line.includes('Analytical') || line.includes('মানসিক দক্ষতা')) currentSubject = 'ANALYTICAL';
    else if (line.includes('ICT') || line.includes('Computer') || line.includes('কম্পিউটার')) currentSubject = 'COMPUTER_ICT';
    else if (line.includes('সাধারণ জ্ঞান') || line.includes('General Knowledge')) currentSubject = 'GENERAL_KNOWLEDGE';

    // Detect question start: e.g., "41. Two pipes fill..." or "১. ..."
    const qMatch = line.match(/^(\d+|[১-৯]+)\.\s*(.+)/);
    if (qMatch && !line.includes('Exam') && !line.includes('Syllabus') && !line.includes('Mark')) {
      flushQuestion();
      qNum = parseInt(qMatch[1].replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()), 10);
      currentStem = qMatch[2];
      continue;
    }

    // Detect options in line
    if (
      (line.includes('A)') || line.includes('A.') || line.includes('ক.') || line.includes('ক)')) &&
      (line.includes('B)') || line.includes('B.') || line.includes('খ.') || line.includes('খ)'))
    ) {
      const matches = [...line.matchAll(optionRegex)];
      if (matches.length >= 2) {
        for (const m of matches) {
          let key = m[1].toUpperCase();
          if (key === 'ক') key = 'A';
          else if (key === 'খ') key = 'B';
          else if (key === 'গ') key = 'C';
          else if (key === 'ঘ') key = 'D';

          const text = cleanText(m[2]);
          const mathNorm = sanitizeMath(text);
          currentOptions[key as OptionKey] = cleanText(mathNorm.text);
        }
        continue;
      }
    }

    // Detect correct answer: e.g., "সঠিক উত্তর: C) 30 minutes" or "উত্তরঃ ক. বর্ষা আবাহন"
    const ansMatch = line.match(/(?:সঠিক উত্তর|উত্তরঃ|উত্তর|Answer|Ans)[\s:–-]+([A-D]|ক|খ|গ|ঘ)/i);
    if (ansMatch) {
      let key = ansMatch[1].toUpperCase();
      if (key === 'ক') key = 'A';
      else if (key === 'খ') key = 'B';
      else if (key === 'গ') key = 'C';
      else if (key === 'ঘ') key = 'D';
      currentAnswer = key as OptionKey;
      flushQuestion();
      continue;
    }

    // If currently building stem and line doesn't look like options/answer, append
    if (currentStem && !line.startsWith('সঠিক উত্তর') && !line.startsWith('উত্তরঃ')) {
      if (!currentOptions.A && !currentOptions.B) {
        currentStem += ' ' + line;
      }
    }
  }

  flushQuestion();
  console.log(`Extracted ${questions.length} valid questions from ${url}`);
  return questions;
}

