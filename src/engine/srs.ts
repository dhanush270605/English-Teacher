// SM-2 spaced repetition (SuperMemo 2), with quality 0..5.
import type { WordRecord } from '../types';

const DAY = 86400000;

export function review(w: WordRecord, quality: number, now = Date.now()): WordRecord {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ef, interval, reps } = w;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ef);
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const status: WordRecord['status'] = reps >= 4 && interval >= 21 ? 'known' : 'learning';
  return {
    ...w,
    ef,
    interval,
    reps,
    due: now + interval * DAY,
    status,
    correct: w.correct + (q >= 3 ? 1 : 0),
    wrong: w.wrong + (q < 3 ? 1 : 0),
  };
}

export function newWord(word: string, level: string, topic?: string): WordRecord {
  return { word, level, topic, status: 'new', ef: 2.5, interval: 0, reps: 0, due: 0, correct: 0, wrong: 0, misuse: 0 };
}

export function isDue(w: WordRecord, now = Date.now()): boolean {
  return w.status !== 'new' && w.due <= now;
}
