export type OptionKey = 'A' | 'B' | 'C' | 'D';

export type SubjectCode =
  | 'ENGLISH'
  | 'MATH'
  | 'ANALYTICAL'
  | 'COMPUTER_ICT'
  | 'GENERAL_KNOWLEDGE';

export interface OptionDiagnostic {
  status: 'CORRECT' | 'TRAP_DISTRACTOR';
  verdict: string;
}

export interface AIExplanationPayload {
  questionId: string;
  coreConcept: string;
  examHallShortcut: string;
  stepByStep: string;
  optionDiagnostics: Record<OptionKey, OptionDiagnostic>;
  generatedBy: string;
  cachedAt: number;
}

export interface ExplainApiRequest {
  questionId: string;
  hash?: string;
  subject?: SubjectCode;
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

export interface Env {
  AI: any; // Cloudflare Workers AI binding
  CACHE: KVNamespace; // Cloudflare KV binding
  ALLOWED_ORIGIN?: string;
  OPENROUTER_API_KEY?: string;
}

export interface ExplainWritingRequest {
  questionId: string;
  category: string;
  stem: string;
  marks: number;
}

export interface ExplainWritingResponse {
  ok: boolean;
  modelAnswer?: string;
  generatedBy?: string;
  error?: string;
}


