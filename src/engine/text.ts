// Pure text utilities used by every analysis engine. No AI involved.
import { COMMON_WORDS } from '../data/content/commonWords';

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ').filter((t) => t && t !== '-' && t !== "'") : [];
}

export function sentences(s: string): string[] {
  return s
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => tokenize(x).length > 0);
}

/** Disfluency fillers that are always counted. */
const HARD_FILLERS = new Set(['um', 'umm', 'ummm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hmm', 'hm', 'ah', 'aah', 'eh', 'mm']);
/** Discourse words that become fillers when overused. */
export const SOFT_FILLERS = ['actually', 'basically', 'literally', 'so yeah', 'you know', 'i mean', 'kind of', 'sort of', 'like'];

export interface FillerReport {
  total: number;
  hard: number;
  soft: number;
  byWord: Record<string, number>;
}

/**
 * Counts fillers. "like" is only counted when it is used as a discourse marker
 * (between commas, at the start, or before another filler) – not "I like tea" / "looks like".
 */
export function countFillers(text: string): FillerReport {
  const byWord: Record<string, number> = {};
  const add = (w: string) => (byWord[w] = (byWord[w] || 0) + 1);
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  const toks = tokenize(text);
  let hard = 0;
  for (const t of toks) if (HARD_FILLERS.has(t)) { hard++; add(t.startsWith('u') ? 'um/uh' : t); }
  let soft = 0;
  for (const phrase of ['you know', 'i mean', 'kind of', 'sort of', 'so yeah']) {
    const re = new RegExp(`\\b${phrase}\\b`, 'g');
    const m = lower.match(re);
    if (m) { soft += m.length; byWord[phrase] = (byWord[phrase] || 0) + m.length; }
  }
  // "you know what" / "i mean it" are legitimate; subtract simple cases
  const legit = lower.match(/\byou know (what|how|why|that|him|her|them|it)\b/g);
  if (legit) { soft -= legit.length; byWord['you know'] = Math.max(0, (byWord['you know'] || 0) - legit.length); }
  for (const w of ['actually', 'basically', 'literally']) {
    const m = lower.match(new RegExp(`\\b${w}\\b`, 'g'));
    if (m) { soft += m.length; byWord[w] = m.length; }
  }
  // discourse "like": ", like," | "^like," | "like, " | "was like" (quotative)
  const likeRe = /(^|[,.!?]\s*)like\b|\blike\s*,|\b(was|is|were|i'm|he's|she's)\s+like\s+(um|uh|,)/g;
  const lm = lower.match(likeRe);
  if (lm) { soft += lm.length; byWord['like'] = lm.length; }
  for (const k of Object.keys(byWord)) if (!byWord[k]) delete byWord[k];
  return { total: hard + soft, hard, soft, byWord };
}

export interface RepetitionReport {
  immediate: number; // "I I", "the the"
  phrase: number; // repeated bigram within a short window (restarts)
  overused: { word: string; count: number }[];
}

export function repetition(text: string): RepetitionReport {
  const toks = tokenize(text).filter((t) => !HARD_FILLERS.has(t));
  let immediate = 0;
  for (let i = 1; i < toks.length; i++) if (toks[i] === toks[i - 1] && toks[i].length > 0 && toks[i] !== 'very' && toks[i] !== 'had') immediate++;
  let phrase = 0;
  for (let i = 0; i + 3 < toks.length; i++) {
    const bg = toks[i] + ' ' + toks[i + 1];
    for (let j = i + 2; j <= Math.min(i + 6, toks.length - 2); j++) {
      if (toks[j] + ' ' + toks[j + 1] === bg) { phrase++; break; }
    }
  }
  const counts: Record<string, number> = {};
  for (const t of toks) if (!COMMON_WORDS.has(t) && t.length > 2) counts[t] = (counts[t] || 0) + 1;
  const overused = Object.entries(counts)
    .filter(([, c]) => c >= 4 && c / Math.max(toks.length, 1) > 0.03)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
  return { immediate, phrase, overused };
}

/** MTLD (McCarthy & Jarvis 2010), bidirectional, threshold 0.72. */
export function mtld(tokens: string[], threshold = 0.72): number {
  if (tokens.length < 10) return 0;
  const pass = (arr: string[]) => {
    let factors = 0, types = new Set<string>(), count = 0;
    for (const t of arr) {
      count++; types.add(t);
      const ttr = types.size / count;
      if (ttr <= threshold) { factors++; types = new Set(); count = 0; }
    }
    if (count > 0) {
      const ttr = types.size / count;
      factors += (1 - ttr) / (1 - threshold);
    }
    return factors > 0 ? arr.length / factors : arr.length;
  };
  return (pass(tokens) + pass([...tokens].reverse())) / 2;
}

/** Guiraud's root TTR – more stable than plain TTR for short answers. */
export function guiraud(tokens: string[]): number {
  if (!tokens.length) return 0;
  return new Set(tokens).size / Math.sqrt(tokens.length);
}

const SUBORDINATORS = new Set(['because', 'although', 'though', 'which', 'who', 'whom', 'whose', 'when', 'while', 'if', 'unless', 'since', 'whereas', 'until', 'after', 'before', 'that', 'where', 'whether', 'so that', 'even though']);

export interface ComplexityReport {
  sentenceCount: number;
  avgSentenceLength: number;
  subordinationPerSentence: number;
}

export function complexity(text: string): ComplexityReport {
  const ss = sentences(text);
  const lens = ss.map((s) => tokenize(s).length);
  const total = lens.reduce((a, b) => a + b, 0);
  let sub = 0;
  for (const s of ss) for (const t of tokenize(s)) if (SUBORDINATORS.has(t)) sub++;
  return {
    sentenceCount: ss.length,
    avgSentenceLength: ss.length ? total / ss.length : 0,
    subordinationPerSentence: ss.length ? sub / ss.length : 0,
  };
}

/** Share of content tokens outside the most-common-words list. */
export function sophistication(tokens: string[]): number {
  const content = tokens.filter((t) => t.length > 2 && !/^\d+$/.test(t) && !HARD_FILLERS.has(t));
  if (!content.length) return 0;
  const rare = content.filter((t) => !COMMON_WORDS.has(t) && !COMMON_WORDS.has(t.replace(/(s|es|ed|ing|ly)$/, '')));
  return rare.length / content.length;
}

const HEDGES = ['maybe', 'i guess', 'i think', 'probably', 'perhaps', 'not sure', 'i don\'t know', 'sort of', 'kind of'];
export function hedgeCount(text: string): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const h of HEDGES) {
    const m = lower.match(new RegExp(`\\b${h.replace("'", "'")}\\b`, 'g'));
    if (m) n += m.length;
  }
  return n;
}

/** Levenshtein alignment of two token arrays. Returns per-reference-word status. */
export function alignWords(reference: string[], hypothesis: string[]): { word: string; status: 'ok' | 'sub' | 'del'; heard?: string }[] {
  const n = reference.length, m = hypothesis.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const cost = reference[i - 1] === hypothesis[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  const out: { word: string; status: 'ok' | 'sub' | 'del'; heard?: string }[] = [];
  let i = n, j = m;
  while (i > 0) {
    if (j > 0 && d[i][j] === d[i - 1][j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)) {
      out.push({ word: reference[i - 1], status: reference[i - 1] === hypothesis[j - 1] ? 'ok' : 'sub', heard: hypothesis[j - 1] });
      i--; j--;
    } else if (d[i][j] === d[i - 1][j] + 1) {
      out.push({ word: reference[i - 1], status: 'del' });
      i--;
    } else {
      j--;
    }
  }
  return out.reverse();
}

export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const lin = (v: number, from: number, to: number) => clamp(((v - from) / (to - from)) * 100);

export type DiffOp = { type: 'same' | 'del' | 'add'; text: string };

/** Word-level diff (LCS) between what the learner said and the corrected version, for strike-through display. */
export function diffWords(original: string, corrected: string): DiffOp[] {
  const a = original.trim().split(/\s+/).filter(Boolean);
  const b = corrected.trim().split(/\s+/).filter(Boolean);
  const key = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = key(a[i]) === key(b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) { ops.push({ type: 'same', text: b[j] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push({ type: 'del', text: a[i++] });
    else ops.push({ type: 'add', text: b[j++] });
  }
  while (i < n) ops.push({ type: 'del', text: a[i++] });
  while (j < m) ops.push({ type: 'add', text: b[j++] });
  // merge neighbours of the same type
  const merged: DiffOp[] = [];
  for (const o of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === o.type) last.text += ' ' + o.text; else merged.push({ ...o });
  }
  return merged;
}
