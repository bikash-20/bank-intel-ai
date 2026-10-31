import type { QuestionItem, SubjectCode, Faculty } from '../types';

export interface BitmaskIndex {
  totalQuestions: number;
  wordCount: number; // Math.ceil(totalQuestions / 32)
  facetBitmaps: Map<string, Uint32Array>; // Key: "FACET_NAME:VALUE" -> Uint32Array
}

export function buildBitmaskIndex(questions: QuestionItem[]): BitmaskIndex {
  const N = questions.length;
  const wordCount = Math.max(1, Math.ceil(N / 32));
  const facetBitmaps = new Map<string, Uint32Array>();

  const getOrCreateBitset = (facetKey: string): Uint32Array => {
    let bitset = facetBitmaps.get(facetKey);
    if (!bitset) {
      bitset = new Uint32Array(wordCount);
      facetBitmaps.set(facetKey, bitset);
    }
    return bitset;
  };

  const setBit = (bitset: Uint32Array, index: number) => {
    const word = index >>> 5; // index / 32
    const bit = index & 31; // index % 32
    bitset[word] |= 1 << bit;
  };

  for (let i = 0; i < N; i++) {
    const q = questions[i];

    // Index Subject
    if (q.subject) {
      setBit(getOrCreateBitset(`SUBJECT:${q.subject}`), i);
    }

    // Index Topic
    if (q.topic) {
      setBit(getOrCreateBitset(`TOPIC:${q.topic}`), i);
    }

    // Index Math Presence
    if (q.hasMath) {
      setBit(getOrCreateBitset('HAS_MATH:true'), i);
    }

    // Index Appearances
    if (q.appearances) {
      for (const app of q.appearances) {
        if (app.examBody) setBit(getOrCreateBitset(`EXAM_BODY:${app.examBody}`), i);
        if (app.post) setBit(getOrCreateBitset(`POST:${app.post}`), i);
        if (app.year) setBit(getOrCreateBitset(`YEAR:${app.year}`), i);
        if (app.faculty) setBit(getOrCreateBitset(`FACULTY:${app.faculty}`), i);
      }
    }
  }

  return {
    totalQuestions: N,
    wordCount,
    facetBitmaps,
  };
}

export interface FilterCriteria {
  subjects?: SubjectCode[];
  years?: number[];
  posts?: string[];
  faculties?: Faculty[];
  hasMath?: boolean;
}

/**
 * Performs $O(N / 32)$ multi-facet filtering.
 * Returns the matching dense indices in $i \in [0, N-1]$.
 */
export function queryBitmaskIndex(
  index: BitmaskIndex,
  criteria: FilterCriteria
): number[] {
  const { totalQuestions, wordCount, facetBitmaps } = index;
  if (totalQuestions === 0) return [];

  // Group filters into AND groups, where each facet group can have multiple OR options:
  // e.g. (Subject == MATH || Subject == ENGLISH) AND (Year == 2026)
  const groupBitsets: Uint32Array[] = [];

  const addFacetGroup = (keys: string[]) => {
    if (keys.length === 0) return;
    const combined = new Uint32Array(wordCount);
    let hasAny = false;

    for (const key of keys) {
      const bitset = facetBitmaps.get(key);
      if (bitset) {
        hasAny = true;
        for (let w = 0; w < wordCount; w++) {
          combined[w] |= bitset[w];
        }
      }
    }

    if (hasAny) {
      groupBitsets.push(combined);
    } else {
      // If none of the selected criteria exist in the index, result is empty
      const empty = new Uint32Array(wordCount);
      groupBitsets.push(empty);
    }
  };

  if (criteria.subjects && criteria.subjects.length > 0) {
    addFacetGroup(criteria.subjects.map((s) => `SUBJECT:${s}`));
  }
  if (criteria.years && criteria.years.length > 0) {
    addFacetGroup(criteria.years.map((y) => `YEAR:${y}`));
  }
  if (criteria.posts && criteria.posts.length > 0) {
    addFacetGroup(criteria.posts.map((p) => `POST:${p}`));
  }
  if (criteria.faculties && criteria.faculties.length > 0) {
    addFacetGroup(criteria.faculties.map((f) => `FACULTY:${f}`));
  }
  if (criteria.hasMath !== undefined) {
    addFacetGroup([criteria.hasMath ? 'HAS_MATH:true' : 'HAS_MATH:false']);
  }

  // If no filters are active, match all questions
  const resultMask = new Uint32Array(wordCount);
  if (groupBitsets.length === 0) {
    resultMask.fill(0xffffffff);
  } else {
    // Start with the first group
    resultMask.set(groupBitsets[0]);
    // Intersect with remaining groups via bitwise AND: O(N / 32)
    for (let g = 1; g < groupBitsets.length; g++) {
      const group = groupBitsets[g];
      for (let w = 0; w < wordCount; w++) {
        resultMask[w] &= group[w];
      }
    }
  }

  // Extract question indexes from the final bitmask
  const matchingIndices: number[] = [];
  for (let w = 0; w < wordCount; w++) {
    let word = resultMask[w];
    if (word === 0) continue;

    const baseIdx = w << 5; // w * 32
    while (word !== 0) {
      // Find trailing zeros (least significant bit set)
      const bit = Math.clz32(word & -word) ^ 31;
      const questionIdx = baseIdx + bit;
      if (questionIdx < totalQuestions) {
        matchingIndices.push(questionIdx);
      }
      word &= word - 1; // Clear least significant bit
    }
  }

  return matchingIndices;
}
