import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBitmaskIndex, queryBitmaskIndex } from '../lib/search/bitmask-index.ts';
import type { QuestionItem } from '../lib/types';

test('Bitmask Index: builds and filters with O(N/32) bitwise speed', () => {
  const mockQuestions: QuestionItem[] = [
    {
      id: 'q1',
      hash: 'h1',
      subject: 'MATH',
      topic: 'Probability',
      hasMath: true,
      stem: 'Question 1',
      options: { A: '1', B: '2', C: '3', D: '4' },
      correctOption: 'A',
      appearances: [{ examBody: 'BB', post: 'Assistant Director', year: 2026, faculty: 'BIBM' }],
    },
    {
      id: 'q2',
      hash: 'h2',
      subject: 'ENGLISH',
      topic: 'Prepositions',
      hasMath: false,
      stem: 'Question 2',
      options: { A: 'in', B: 'on', C: 'at', D: 'by' },
      correctOption: 'B',
      appearances: [{ examBody: 'BB', post: 'Assistant Director', year: 2026, faculty: 'BIBM' }],
    },
    {
      id: 'q3',
      hash: 'h3',
      subject: 'MATH',
      topic: 'Profit & Loss',
      hasMath: true,
      stem: 'Question 3',
      options: { A: '10%', B: '20%', C: '30%', D: '40%' },
      correctOption: 'C',
      appearances: [{ examBody: 'BB', post: 'Officer (Cash)', year: 2023, faculty: 'BIBM' }],
    },
  ];

  const index = buildBitmaskIndex(mockQuestions);

  // 1. Filter by Subject = MATH
  const mathMatches = queryBitmaskIndex(index, { subjects: ['MATH'] });
  assert.deepEqual(mathMatches, [0, 2]);

  // 2. Filter by Year = 2026
  const y2026Matches = queryBitmaskIndex(index, { years: [2026] });
  assert.deepEqual(y2026Matches, [0, 1]);

  // 3. Combined Filter: Subject = MATH && Year = 2026
  const combinedMatches = queryBitmaskIndex(index, {
    subjects: ['MATH'],
    years: [2026],
  });
  assert.deepEqual(combinedMatches, [0]);
});
