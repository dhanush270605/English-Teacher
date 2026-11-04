// Transparent scoring formulas. Each score is a documented function of measured evidence.
// See docs/SCORING.md for the human-readable version of every formula below.
import type { Correction, Scores, SpeechMetrics } from '../types';
import { clamp, lin, sentences, tokenize } from './text';

export interface GrammarEvidence {
  errors: number; // verified corrections (quote found in transcript)
  words: number;
  sentences: number;
  errorFreeSentences: number;
}

/** Keep only corrections whose `original` text actually appears in what the learner said. */
export function verifyCorrections(transcript: string, corrections: Correction[]): Correction[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  const t = norm(transcript);
  const seen = new Set<string>();
  return corrections.filter((c) => {
    if (!c || !c.original || !c.corrected) return false;
    const o = norm(c.original);
    if (!o || o === norm(c.corrected)) return false;
    if (seen.has(o)) return false;
    seen.add(o);
    if (t.includes(o)) return true;
    // tolerate the model trimming punctuation or one edge word
    const ow = o.split(' ');
    return ow.length >= 3 && t.includes(ow.slice(1, -1).join(' '));
  });
}

export function grammarEvidence(transcript: string, verified: Correction[]): GrammarEvidence {
  const ss = sentences(transcript);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  let errorFree = 0;
  for (const s of ss) {
    const ns = norm(s);
    const hasErr = verified.some((c) => { const o = norm(c.original); return ns.includes(o) || o.includes(ns); });
    if (!hasErr) errorFree++;
  }
  return { errors: verified.length, words: tokenize(transcript).length, sentences: Math.max(ss.length, 1), errorFreeSentences: errorFree };
}

/** Grammar = 50% error-free-sentence ratio + 50% (100 − 10 × errors per 100 words). */
export function grammarScore(e: GrammarEvidence): number {
  if (e.words < 3) return 0;
  const s1 = (100 * e.errorFreeSentences) / e.sentences;
  const per100 = (e.errors / e.words) * 100;
  const s2 = clamp(100 - 10 * per100);
  return Math.round(0.5 * s1 + 0.5 * s2);
}

/** Vocabulary = 60% lexical diversity (MTLD 20→90, or root-TTR 2.5→7.5 under 50 words) + 40% sophistication (0→25% less-common words) − 3 per overused word (max −15). */
export function vocabularyScore(m: SpeechMetrics): number {
  const diversity = m.words >= 50 ? lin(m.mtld, 20, 90) : lin(m.guiraud, 2.5, 7.5);
  const soph = lin(m.sophistication, 0, 0.25);
  const penalty = Math.min(15, 3 * m.overused.length);
  return Math.round(clamp(0.6 * diversity + 0.4 * soph - penalty));
}

/** Speech-rate sub-score: 100 inside 110–170 wpm, linear to 0 at 50 and 230. Speed alone is NOT fluency. */
export function rateScore(wpm: number): number {
  if (wpm >= 110 && wpm <= 170) return 100;
  if (wpm < 110) return lin(wpm, 50, 110);
  return clamp(100 - ((wpm - 170) / 60) * 100);
}

export function fillerScore(per100: number): number {
  return clamp(100 - 12 * per100);
}

/** Fluency = 35% mean length of run + 25% long-pause score + 25% filler score + 15% rate score.
 *  Without word timings: 60% filler + 40% rate (marked as partial). */
export function fluencyScore(m: SpeechMetrics): { score: number; partial: boolean } {
  const fs = fillerScore(m.fillersPer100);
  const rs = rateScore(m.articulationWpm ?? m.wpm);
  if (m.timingAvailable && m.meanLengthOfRun !== undefined && m.longPausesPerMin !== undefined) {
    const mlr = lin(m.meanLengthOfRun, 2, 10);
    const ps = clamp(100 - 15 * m.longPausesPerMin);
    return { score: Math.round(0.35 * mlr + 0.25 * ps + 0.25 * fs + 0.15 * rs), partial: false };
  }
  return { score: Math.round(0.6 * fs + 0.4 * rs), partial: true };
}

/** Pronunciation (APPROXIMATE): recogniser clarity, optionally blended 50/50 with read-aloud word accuracy. */
export function pronunciationScore(asrClarity?: number, readAloudAccuracy?: number): number | undefined {
  const parts: number[] = [];
  if (typeof asrClarity === 'number') parts.push(lin(asrClarity, 0.5, 0.95));
  if (typeof readAloudAccuracy === 'number') parts.push(clamp(readAloudAccuracy * 100));
  if (!parts.length) return undefined;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Sentence construction = 60% error-free-sentence ratio + 40% complexity (length 5→12 words & subordination). */
export function constructionScore(m: SpeechMetrics, e: GrammarEvidence): number {
  const lenScore = m.avgSentenceLength <= 12 ? lin(m.avgSentenceLength, 4, 12) : clamp(100 - (m.avgSentenceLength - 25) * 5);
  const sub = lin(m.subordinationPerSentence, 0, 0.6);
  const complexityScore = 0.5 * lenScore + 0.5 * sub;
  const efs = (100 * e.errorFreeSentences) / e.sentences;
  return Math.round(0.6 * efs + 0.4 * complexityScore);
}

/** Speaking consistency = 50% (100 − 60 × run-length CV) + 50% phonation ratio (0.4→0.85). Needs timings. */
export function consistencyScore(m: SpeechMetrics): number | undefined {
  if (!m.timingAvailable || m.runLengthCV === undefined) return undefined;
  const a = clamp(100 - 60 * m.runLengthCV);
  const b = m.phonationRatio !== undefined ? lin(m.phonationRatio, 0.4, 0.85) : a;
  return Math.round(0.5 * a + 0.5 * b);
}

export const OVERALL_WEIGHTS: Record<keyof Omit<Scores, 'overall' | 'consistency'>, number> = {
  grammar: 0.25,
  fluency: 0.2,
  vocabulary: 0.15,
  construction: 0.15,
  relevance: 0.15,
  pronunciation: 0.1,
};

export function overallScore(s: Omit<Scores, 'overall'>): number {
  let tot = 0, w = 0;
  for (const [k, wt] of Object.entries(OVERALL_WEIGHTS)) {
    const v = (s as any)[k];
    if (typeof v === 'number' && !Number.isNaN(v)) { tot += v * wt; w += wt; }
  }
  return w ? Math.round(tot / w) : 0;
}

export interface FullScoreInput {
  transcript: string;
  metrics: SpeechMetrics;
  corrections: Correction[]; // unverified from AI
  relevance?: number; // rubric 0..4 from AI, optional
  readAloudAccuracy?: number;
}

export function scoreSession(inp: FullScoreInput): { scores: Scores; verified: Correction[]; fluencyPartial: boolean; evidence: GrammarEvidence } {
  const verified = verifyCorrections(inp.transcript, inp.corrections);
  const ev = grammarEvidence(inp.transcript, verified);
  const fl = fluencyScore(inp.metrics);
  const base: Omit<Scores, 'overall'> = {
    grammar: grammarScore(ev),
    vocabulary: vocabularyScore(inp.metrics),
    fluency: fl.score,
    construction: constructionScore(inp.metrics, ev),
    pronunciation: pronunciationScore(inp.metrics.asrClarity, inp.readAloudAccuracy),
    consistency: consistencyScore(inp.metrics),
    relevance: typeof inp.relevance === 'number' ? Math.round(clamp(inp.relevance, 0, 4) * 25) : undefined,
  };
  return { scores: { ...base, overall: overallScore(base) }, verified, fluencyPartial: fl.partial, evidence: ev };
}

/** Observable delivery indicators. We do NOT claim to measure psychological confidence. */
export function deliveryIndicators(m: SpeechMetrics) {
  const items: { label: string; value: string; good: boolean }[] = [];
  items.push({ label: 'Fillers per 100 words', value: m.fillersPer100.toFixed(1), good: m.fillersPer100 <= 3 });
  if (m.longPausesPerMin !== undefined) items.push({ label: 'Long pauses (≥1s) per minute', value: m.longPausesPerMin.toFixed(1), good: m.longPausesPerMin <= 2 });
  items.push({ label: 'Restarts / repeated words', value: String(m.restarts + m.immediateRepeats), good: m.restarts + m.immediateRepeats <= 2 });
  items.push({ label: 'Hedging phrases', value: String(m.hedges), good: m.hedges <= 3 });
  items.push({ label: 'Words spoken', value: String(m.words), good: m.words >= 40 });
  return items;
}

export function compareToPrevious(current: Scores, previous: Scores[]): Partial<Record<keyof Scores, number>> {
  const out: Partial<Record<keyof Scores, number>> = {};
  if (!previous.length) return out;
  for (const k of Object.keys(current) as (keyof Scores)[]) {
    const vals = previous.map((p) => p[k]).filter((v): v is number => typeof v === 'number');
    const cur = current[k];
    if (vals.length && typeof cur === 'number') out[k] = Math.round(cur - vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}
