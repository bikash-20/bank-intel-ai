export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type SubjectCode =
  | 'ENGLISH'
  | 'MATH'
  | 'ANALYTICAL'
  | 'COMPUTER_ICT'
  | 'GENERAL_KNOWLEDGE';

export type ExamBody = 'BB' | 'BSC' | 'COMMERCIAL';

export type Faculty = 'BIBM' | 'IBA' | 'DU_ARTS' | 'CTI' | 'UNKNOWN';

export interface ExamAppearance {
  examBody: ExamBody;
  post: string; // e.g., "Assistant Director", "Officer (Cash)", "Senior Officer (IT)"
  year: number; // e.g., 2026
  examDate?: string; // e.g., "2026-07-17"
  faculty?: Faculty;
}

export interface OptionDiagnostic {
  status: 'CORRECT' | 'TRAP_DISTRACTOR';
  verdict: string;
}

export interface AIExplanationPayload {
  questionId: string;
  coreConcept: string; // 1-line fundamental rule or formula
  examHallShortcut: string; // <30s mental math or elimination strategy (KaTeX supported)
  stepByStep: string; // Concise derivation
  optionDiagnostics: Record<OptionKey, OptionDiagnostic>;
  generatedBy: string; // Model identifier for telemetry
  cachedAt: number;
}

export interface QuestionItem {
  id: string; // Deterministic: e.g., "bb-ad-2026-q014"
  hash: string; // 16-char SHA-256 of normalized stem
  subject: SubjectCode;
  topic: string; // e.g., "Profit & Loss", "Prefix & Suffix", "Probability"
  hasMath: boolean; // Controls whether async KaTeX pipeline loads
  stem: string; // Markdown + $inline$ LaTeX
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
  appearances: ExamAppearance[];
  staticExplanation?: AIExplanationPayload; // Populated if pre-baked
}

export interface ShardManifestItem {
  id: string; // e.g., "bb-ad-2026"
  title: string;
  examBody: ExamBody;
  post: string;
  year: number;
  faculty: Faculty;
  questionCount: number;
  fileName: string; // e.g., "bb-ad-2026.json"
  versionHash: string; // Hash of file content for cache invalidation
  updatedAt: string;
}

export interface ShardManifest {
  version: string;
  shards: ShardManifestItem[];
}

export interface UserAttempt {
  questionId: string;
  selectedOption: OptionKey;
  isCorrect: boolean;
  timeSpentMs: number;
  timestamp: number;
  mode: 'PRACTICE' | 'SIMULATOR';
}

export interface MistakeItem {
  questionId: string;
  wrongCount: number;
  correctStreak: number; // Graduated when >= 3
  lastAttemptedAt: number;
  notes?: string;
  isBookmarked?: boolean;
}

export interface BootSummary {
  theme: 'dark' | 'light';
  lastShardId: string;
  totalAttempts: number;
  correctAttempts: number;
  streakDays: number;
  lastActiveDate: string;
}

export interface ExplainApiRequest {
  questionId: string;
  hash: string;
  subject: SubjectCode;
  stem: string;
  options: Record<OptionKey, string>;
  correctOption: OptionKey;
}

export interface ExplainApiResponse {
  ok: boolean;
  cacheStatus: 'HIT_L3A' | 'HIT_KV' | 'MISS_GENERATED';
  data?: AIExplanationPayload;
  error?: string;
}

