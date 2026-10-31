import { openDB, type IDBPDatabase } from 'idb';
import type {
  QuestionItem,
  AIExplanationPayload,
  UserAttempt,
  MistakeItem,
} from '../types';

const DB_NAME = 'bank_intel_db';
const DB_VERSION = 1;

export interface BankIntelDBSchema {
  questions: {
    key: string;
    value: QuestionItem;
    indexes: { 'by-hash': string; 'by-subject': string };
  };
  explanations: {
    key: string;
    value: AIExplanationPayload;
    indexes: { 'by-question-id': string };
  };
  attempts: {
    key: string; // `${questionId}_${timestamp}`
    value: UserAttempt;
    indexes: { 'by-question': string; 'by-timestamp': number };
  };
  mistakes: {
    key: string; // questionId
    value: MistakeItem;
    indexes: { 'by-streak': number; 'by-timestamp': number };
  };
  meta: {
    key: string;
    value: { key: string; val: any; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<BankIntelDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<BankIntelDBSchema>> {
  if (typeof window === 'undefined') {
    // Return never-resolving mock for SSR
    return new Promise(() => {});
  }

  if (!dbPromise) {
    dbPromise = openDB<BankIntelDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. questions
        if (!db.objectStoreNames.contains('questions')) {
          const qStore = db.createObjectStore('questions', { keyPath: 'id' });
          qStore.createIndex('by-hash', 'hash');
          qStore.createIndex('by-subject', 'subject');
        }

        // 2. explanations
        if (!db.objectStoreNames.contains('explanations')) {
          const eStore = db.createObjectStore('explanations', { keyPath: 'questionId' });
          eStore.createIndex('by-question-id', 'questionId');
        }

        // 3. attempts
        if (!db.objectStoreNames.contains('attempts')) {
          const aStore = db.createObjectStore('attempts', {
            keyPath: 'id',
          });
          aStore.createIndex('by-question', 'questionId');
          aStore.createIndex('by-timestamp', 'timestamp');
        }

        // 4. mistakes
        if (!db.objectStoreNames.contains('mistakes')) {
          const mStore = db.createObjectStore('mistakes', { keyPath: 'questionId' });
          mStore.createIndex('by-streak', 'correctStreak');
          mStore.createIndex('by-timestamp', 'lastAttemptedAt');
        }

        // 5. meta
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Bulk writes questions into IndexedDB in a single transaction.
 */
export async function bulkWriteQuestions(questions: QuestionItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('questions', 'readwrite');
  for (const q of questions) {
    tx.store.put(q);
  }
  await tx.done;
}

export async function getAllQuestionsFromIDB(): Promise<QuestionItem[]> {
  const db = await getDB();
  return db.getAll('questions');
}

export async function getExplanationFromIDB(questionId: string): Promise<AIExplanationPayload | undefined> {
  const db = await getDB();
  return db.get('explanations', questionId);
}

export async function saveExplanationToIDB(payload: AIExplanationPayload): Promise<void> {
  const db = await getDB();
  await db.put('explanations', payload);
}

export async function recordUserAttempt(attempt: UserAttempt): Promise<void> {
  const db = await getDB();
  const attemptId = `${attempt.questionId}_${attempt.timestamp}`;

  const tx = db.transaction(['attempts', 'mistakes'], 'readwrite');
  await tx.objectStore('attempts').put({ ...attempt, id: attemptId } as any);

  // Update Mistake Vault
  const mistakeStore = tx.objectStore('mistakes');
  const existingMistake = await mistakeStore.get(attempt.questionId);

  if (!attempt.isCorrect) {
    // Answer was incorrect: reset streak and increment wrongCount
    const updatedMistake: MistakeItem = {
      questionId: attempt.questionId,
      wrongCount: (existingMistake?.wrongCount || 0) + 1,
      correctStreak: 0,
      lastAttemptedAt: attempt.timestamp,
      isBookmarked: existingMistake?.isBookmarked || false,
    };
    await mistakeStore.put(updatedMistake);
  } else if (existingMistake) {
    // Answer was correct: increment streak.
    // If streak reaches >= 3, question graduates from the vault!
    const newStreak = (existingMistake.correctStreak || 0) + 1;
    if (newStreak >= 3) {
      await mistakeStore.delete(attempt.questionId);
    } else {
      await mistakeStore.put({
        ...existingMistake,
        correctStreak: newStreak,
        lastAttemptedAt: attempt.timestamp,
      });
    }
  }

  await tx.done;
}

export async function getMistakes(): Promise<MistakeItem[]> {
  const db = await getDB();
  return db.getAll('mistakes');
}

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const db = await getDB();
  const tx = db.transaction('mistakes', 'readwrite');
  const existing = await tx.store.get(questionId);
  const newBookmarked = !existing?.isBookmarked;

  if (existing) {
    await tx.store.put({ ...existing, isBookmarked: newBookmarked });
  } else {
    await tx.store.put({
      questionId,
      wrongCount: 0,
      correctStreak: 0,
      lastAttemptedAt: Date.now(),
      isBookmarked: true,
    });
  }
  await tx.done;
  return newBookmarked;
}

export async function getMeta(key: string): Promise<any> {
  const db = await getDB();
  const record = await db.get('meta', key);
  return record?.val;
}

export async function setMeta(key: string, val: any): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, val, updatedAt: Date.now() });
}
