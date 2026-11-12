export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  tier?: 'fast' | 'smart';
  image?: { mime: string; base64: string };
  purpose: string; // for usage monitoring
  search?: boolean; // allow live web search (Gemini Google Search grounding / Groq compound)
}

export interface ChatResult { text: string; tokensIn: number; tokensOut: number; provider: ProviderId; model: string; sources?: { title: string; uri: string }[] }

export type ProviderId = 'groq' | 'gemini';

export type AIErrorKind = 'quota' | 'auth' | 'network' | 'server' | 'bad_request' | 'no_provider' | 'parse' | 'offline';

export class AIError extends Error {
  constructor(public kind: AIErrorKind, message: string, public retryAfterMs?: number, public provider?: ProviderId) {
    super(message);
  }
}

export interface AIConfig {
  order: ProviderId[];
  groqFast: string;
  groqSmart: string;
  geminiFast: string;
  geminiSmart: string;
  whisperModel: string;
  dailyCap: Record<ProviderId, number>; // local safety caps below the free-tier limits
  rpm: Record<ProviderId, number>;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  order: ['gemini', 'groq'],
  groqFast: 'openai/gpt-oss-20b',
  groqSmart: 'openai/gpt-oss-120b',
  geminiFast: 'gemini-2.5-flash-lite',
  geminiSmart: 'gemini-2.5-flash',
  whisperModel: 'whisper-large-v3-turbo',
  dailyCap: { groq: 900, gemini: 400 },
  rpm: { groq: 25, gemini: 10 },
};

export interface LLMProvider {
  id: ProviderId;
  chat(req: ChatRequest, key: string, cfg: AIConfig): Promise<ChatResult>;
}
