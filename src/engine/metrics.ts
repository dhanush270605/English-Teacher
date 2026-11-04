// Deterministic speech + text measurements. Every number here is reproducible from the transcript.
import type { SpeechMetrics, Transcript } from '../types';
import { complexity, countFillers, guiraud, hedgeCount, mtld, repetition, sophistication, tokenize } from './text';

export const PAUSE_MIN = 0.25; // seconds – silent pause threshold used in fluency research
export const LONG_PAUSE = 1.0;

export function computeMetrics(t: Transcript): SpeechMetrics {
  const text = t.text || '';
  const tokens = tokenize(text);
  const fill = countFillers(text);
  const rep = repetition(text);
  const cx = complexity(text);
  const words = tokens.length;

  const timingAvailable = !!(t.words && t.words.length >= 2);
  let speakingSec = t.durationSec || 0;
  let pauses: number | undefined, longPauses: number | undefined, mlr: number | undefined, cv: number | undefined;
  let articulationWpm: number | undefined, phonationRatio: number | undefined;

  if (timingAvailable) {
    const w = t.words!;
    speakingSec = Math.max(0.5, w[w.length - 1].end - w[0].start);
    let pauseTime = 0;
    pauses = 0; longPauses = 0;
    const runs: number[] = [];
    let run = 1;
    for (let i = 1; i < w.length; i++) {
      const gap = w[i].start - w[i - 1].end;
      if (gap >= PAUSE_MIN) {
        pauses++; pauseTime += gap; runs.push(run); run = 1;
        if (gap >= LONG_PAUSE) longPauses++;
      } else run++;
    }
    runs.push(run);
    mlr = runs.reduce((a, b) => a + b, 0) / runs.length;
    const mean = mlr;
    const sd = Math.sqrt(runs.reduce((a, b) => a + (b - mean) ** 2, 0) / runs.length);
    cv = mean > 0 ? sd / mean : 0;
    const phonation = Math.max(0.5, speakingSec - pauseTime);
    articulationWpm = (w.length / phonation) * 60;
    phonationRatio = t.durationSec > 0 ? Math.min(1, phonation / t.durationSec) : undefined;
  }

  const wpm = speakingSec > 0 ? (words / speakingSec) * 60 : 0;
  let asrClarity: number | undefined;
  if (t.segments && t.segments.some((s) => typeof s.avgLogprob === 'number')) {
    let tot = 0, wsum = 0;
    for (const s of t.segments) {
      if (typeof s.avgLogprob !== 'number') continue;
      const dur = Math.max(0.1, s.end - s.start);
      tot += Math.exp(s.avgLogprob) * dur; wsum += dur;
    }
    asrClarity = wsum ? tot / wsum : undefined;
  }

  return {
    words,
    durationSec: t.durationSec,
    speakingSec,
    wpm,
    articulationWpm,
    pauses,
    longPauses,
    longPausesPerMin: longPauses !== undefined ? longPauses / Math.max(speakingSec / 60, 0.25) : undefined,
    meanLengthOfRun: mlr,
    runLengthCV: cv,
    phonationRatio,
    fillers: fill.total,
    fillersPer100: words ? (fill.total / words) * 100 : 0,
    fillerBreakdown: fill.byWord,
    immediateRepeats: rep.immediate,
    restarts: rep.phrase,
    overused: rep.overused,
    mtld: mtld(tokens),
    guiraud: guiraud(tokens),
    sophistication: sophistication(tokens),
    avgSentenceLength: cx.avgSentenceLength,
    subordinationPerSentence: cx.subordinationPerSentence,
    sentenceCount: cx.sentenceCount,
    hedges: hedgeCount(text),
    timingAvailable,
    asrClarity,
  };
}

/** Merge metrics across several answers of one session (weighted by words). */
export function mergeTranscripts(ts: Transcript[]): Transcript {
  let offset = 0;
  const words: Transcript['words'] = [];
  const segments: Transcript['segments'] = [];
  let allTimed = ts.length > 0;
  for (const t of ts) {
    if (!t.words?.length) allTimed = false;
    for (const w of t.words || []) words.push({ word: w.word, start: w.start + offset, end: w.end + offset });
    for (const s of t.segments || []) segments.push({ ...s, start: s.start + offset, end: s.end + offset });
    // insert an artificial 0.2s boundary (below pause threshold would merge runs; use 2s so turn gaps are not counted as long pauses)
    offset += (t.durationSec || 0) + 0.2;
  }
  // Turn boundaries are not pauses: we compute metrics per transcript and keep timing only if all are timed.
  return {
    text: ts.map((t) => t.text.trim()).filter(Boolean).map((s) => (/[.!?]$/.test(s) ? s : s + '.')).join(' '),
    words: allTimed ? words : undefined,
    segments,
    durationSec: ts.reduce((a, t) => a + (t.durationSec || 0), 0),
    engine: ts[0]?.engine || 'typed',
  };
}

/** Aggregate metrics per answer, then average – avoids counting the gap between turns as a pause. */
export function sessionMetrics(ts: Transcript[]): SpeechMetrics | undefined {
  const valid = ts.filter((t) => tokenize(t.text).length > 0);
  if (!valid.length) return undefined;
  const parts = valid.map(computeMetrics);
  const merged = computeMetrics({ ...mergeTranscripts(valid), words: undefined });
  const W = parts.reduce((a, p) => a + p.words, 0) || 1;
  const wavg = (f: (p: SpeechMetrics) => number | undefined) => {
    const have = parts.filter((p) => typeof f(p) === 'number');
    if (!have.length) return undefined;
    const w = have.reduce((a, p) => a + p.words, 0) || 1;
    return have.reduce((a, p) => a + (f(p) as number) * p.words, 0) / w;
  };
  const sum = (f: (p: SpeechMetrics) => number | undefined) => parts.reduce((a, p) => a + (f(p) || 0), 0);
  const speakingSec = sum((p) => p.speakingSec);
  const timingAvailable = parts.every((p) => p.timingAvailable);
  return {
    ...merged,
    words: W,
    durationSec: sum((p) => p.durationSec),
    speakingSec,
    wpm: speakingSec ? (W / speakingSec) * 60 : 0,
    articulationWpm: wavg((p) => p.articulationWpm),
    pauses: timingAvailable ? sum((p) => p.pauses) : undefined,
    longPauses: timingAvailable ? sum((p) => p.longPauses) : undefined,
    longPausesPerMin: timingAvailable ? sum((p) => p.longPauses) / Math.max(speakingSec / 60, 0.25) : undefined,
    meanLengthOfRun: wavg((p) => p.meanLengthOfRun),
    runLengthCV: wavg((p) => p.runLengthCV),
    phonationRatio: wavg((p) => p.phonationRatio),
    asrClarity: wavg((p) => p.asrClarity),
    timingAvailable,
  };
}
