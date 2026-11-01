/**
 * Writing Shards & Exam Index Loader with Runtime Validation & Cache
 */

export interface WritingQuestion {
  id: string;
  category: string;
  marks: number;
  stem: string;
}

export interface WritingShard {
  shardId: string;
  title: string;
  examBody: string;
  post: string;
  totalQuestions: number;
  questions: WritingQuestion[];
}

export interface WritingExamIndexItem {
  shardId: string;
  title: string;
  post: string;
  file: string;
}

// In-Memory Caches
const shardCache = new Map<string, WritingShard>();
let indexCache: WritingExamIndexItem[] | null = null;

/**
 * Validates whether an unknown value conforms to WritingExamIndexItem[]
 */
export function validateWritingIndex(data: unknown): WritingExamIndexItem[] {
  if (!Array.isArray(data)) {
    throw new Error('Writing index must be an array');
  }

  return data.map((item, idx) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.shardId !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.post !== 'string' ||
      typeof item.file !== 'string'
    ) {
      throw new Error(`Invalid writing index entry at index ${idx}`);
    }
    return {
      shardId: item.shardId,
      title: item.title,
      post: item.post,
      file: item.file,
    };
  });
}

/**
 * Validates whether an unknown value conforms to WritingShard
 */
export function validateWritingShard(data: unknown): WritingShard {
  if (!data || typeof data !== 'object') {
    throw new Error('Writing shard must be a valid JSON object');
  }

  const s = data as Record<string, unknown>;

  if (
    typeof s.shardId !== 'string' ||
    typeof s.title !== 'string' ||
    typeof s.examBody !== 'string' ||
    typeof s.post !== 'string' ||
    typeof s.totalQuestions !== 'number' ||
    !Array.isArray(s.questions)
  ) {
    throw new Error('Writing shard is missing required top-level fields');
  }

  const questions: WritingQuestion[] = s.questions.map((q, idx) => {
    if (
      !q ||
      typeof q !== 'object' ||
      typeof q.id !== 'string' ||
      typeof q.category !== 'string' ||
      typeof q.marks !== 'number' ||
      typeof q.stem !== 'string'
    ) {
      throw new Error(`Invalid question item at index ${idx} in shard ${s.shardId}`);
    }
    return {
      id: q.id,
      category: q.category,
      marks: q.marks,
      stem: q.stem,
    };
  });

  return {
    shardId: s.shardId,
    title: s.title,
    examBody: s.examBody,
    post: s.post,
    totalQuestions: s.totalQuestions,
    questions,
  };
}

/**
 * Loads and validates the Writing Exams index from /shards/writing-index.json
 */
export async function loadWritingIndex(baseUrl = ''): Promise<WritingExamIndexItem[]> {
  if (indexCache && indexCache.length > 0) {
    return indexCache;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/shards/writing-index.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load writing index: HTTP ${res.status}`);
  }

  const json = await res.json();
  const validated = validateWritingIndex(json);
  indexCache = validated;
  return validated;
}

/**
 * Loads and validates a specific Writing Shard by file path or shardId
 */
export async function loadWritingShard(
  fileOrShardId: string,
  baseUrl = ''
): Promise<WritingShard> {
  const cacheKey = fileOrShardId;
  if (shardCache.has(cacheKey)) {
    return shardCache.get(cacheKey)!;
  }

  let filePath = fileOrShardId;
  if (!filePath.startsWith('/') && !filePath.startsWith('http')) {
    filePath = `/shards/${filePath.endsWith('.json') ? filePath : `${filePath}.json`}`;
  }

  const url = `${baseUrl.replace(/\/$/, '')}${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load writing shard at ${url}: HTTP ${res.status}`);
  }

  const json = await res.json();
  const validated = validateWritingShard(json);
  shardCache.set(cacheKey, validated);
  shardCache.set(validated.shardId, validated);
  return validated;
}

/**
 * Clear the in-memory cache (primarily for tests)
 */
export function clearWritingCache(): void {
  indexCache = null;
  shardCache.clear();
}

