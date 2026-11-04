// Informal CEFR estimate from several assessment activities. NOT an official certification.

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Cefr = (typeof CEFR)[number];

export interface AssessmentParts {
  grammarQuiz?: { byLevel: Record<string, { correct: number; total: number }> };
  vocabTest?: { byLevel: Record<string, { yes: number; total: number }>; falseAlarms: number; pseudoTotal: number };
  speaking?: number[]; // overall scores of speaking parts (0..100)
  listening?: number; // 0..100
}

/** Highest level where accuracy ≥ 60% and all lower levels also passed → score 0..100. */
export function grammarQuizScore(byLevel: Record<string, { correct: number; total: number }>): number {
  let passed = -1;
  for (let i = 0; i < 5; i++) {
    const r = byLevel[CEFR[i]];
    if (!r || !r.total) break;
    if (r.correct / r.total >= 0.6) passed = i; else break;
  }
  const total = Object.values(byLevel).reduce((a, r) => a + r.total, 0) || 1;
  const correct = Object.values(byLevel).reduce((a, r) => a + r.correct, 0);
  // 70% from ladder position, 30% raw accuracy
  return Math.round(0.7 * ((passed + 1) / 5) * 100 + 0.3 * (correct / total) * 100);
}

/** Yes/no vocabulary test corrected for guessing with pseudo-words (hit rate − false-alarm rate). */
export function vocabTestScore(v: NonNullable<AssessmentParts['vocabTest']>): number {
  const fa = v.pseudoTotal ? v.falseAlarms / v.pseudoTotal : 0;
  const weights: Record<string, number> = { A1: 1, A2: 1.5, B1: 2, B2: 2.5, C1: 3 };
  let tot = 0, wsum = 0;
  for (const [lvl, r] of Object.entries(v.byLevel)) {
    if (!r.total) continue;
    const hit = r.yes / r.total;
    const adj = Math.max(0, hit - fa);
    tot += adj * (weights[lvl] || 1); wsum += weights[lvl] || 1;
  }
  return wsum ? Math.round((tot / wsum) * 100) : 0;
}

export interface CefrEstimate {
  level: Cefr | null;
  composite: number;
  partsUsed: number;
  breakdown: Record<string, number>;
  note: string;
}

export function estimateCefr(p: AssessmentParts): CefrEstimate {
  const breakdown: Record<string, number> = {};
  if (p.grammarQuiz) breakdown.grammar = grammarQuizScore(p.grammarQuiz.byLevel);
  if (p.vocabTest) breakdown.vocabulary = vocabTestScore(p.vocabTest);
  if (p.speaking?.length) breakdown.speaking = Math.round(p.speaking.reduce((a, b) => a + b, 0) / p.speaking.length);
  if (typeof p.listening === 'number') breakdown.listening = p.listening;
  const weights: Record<string, number> = { speaking: 0.4, grammar: 0.25, vocabulary: 0.2, listening: 0.15 };
  let tot = 0, w = 0;
  for (const [k, v] of Object.entries(breakdown)) { tot += v * weights[k]; w += weights[k]; }
  const partsUsed = Object.keys(breakdown).length;
  const composite = w ? Math.round(tot / w) : 0;
  if (partsUsed < 3) return { level: null, composite, partsUsed, breakdown, note: 'Complete at least 3 different assessment activities to get an estimate.' };
  let level: Cefr = composite < 20 ? 'A1' : composite < 35 ? 'A2' : composite < 55 ? 'B1' : composite < 72 ? 'B2' : composite < 87 ? 'C1' : 'C2';
  if (level === 'C2' && ((breakdown.speaking ?? 0) < 85 || (breakdown.grammar ?? 0) < 85)) level = 'C1';
  return { level, composite, partsUsed, breakdown, note: 'Informal estimate from in-app activities. Not an official CEFR certificate (e.g. IELTS, Cambridge).' };
}

export function levelToDifficulty(level: string): number {
  return ({ A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 5 } as Record<string, number>)[level] || 3;
}
