import { countFillers, repetition, mtld, tokenize, alignWords, sentences, sophistication } from '../../src/engine/text';
import { computeMetrics, sessionMetrics } from '../../src/engine/metrics';
import { verifyCorrections, grammarEvidence, grammarScore, rateScore, fluencyScore, scoreSession, overallScore, compareToPrevious } from '../../src/engine/scoring';
import { review, newWord } from '../../src/engine/srs';
import { estimateCefr, grammarQuizScore, vocabTestScore } from '../../src/engine/cefr';
import { computeStreak, dateKey, pickFresh } from '../../src/engine/scheduler';
import { adaptDifficulty, pickGrammarTopic, analyzeWeaknesses } from '../../src/engine/recommender';
import type { Transcript, SessionRecord } from '../../src/types';

describe('text', () => {
  it('counts hard fillers and discourse like, not verb like', () => {
    const r = countFillers('Um, I like tea. Like, it was, uh, basically good, you know.');
    expect(r.hard).toBe(2);
    expect(r.byWord['like']).toBe(1);
    expect(r.byWord['basically']).toBe(1);
    expect(r.byWord['you know']).toBe(1);
  });
  it('does not count "you know what"', () => {
    expect(countFillers('You know what, I agree.').total).toBe(0);
  });
  it('detects immediate repeats and restarts', () => {
    const r = repetition('I I went to the the market yesterday');
    expect(r.immediate).toBe(2);
    expect(repetition('I went to, I went to the market').phrase).toBeGreaterThanOrEqual(1);
  });
  it('MTLD higher for diverse text', () => {
    const rep = tokenize('the cat the cat the cat the cat the cat the cat the cat the cat');
    const div = tokenize('the quick brown fox jumps over a lazy dog while birds sing near quiet rivers today');
    expect(mtld(div)).toBeGreaterThan(mtld(rep));
  });
  it('splits sentences', () => {
    expect(sentences('Hello there. How are you? Fine!')).toHaveLength(3);
  });
  it('aligns words', () => {
    const a = alignWords(['she', 'sells', 'sea', 'shells'], ['she', 'cells', 'shells']);
    expect(a.filter((x) => x.status === 'ok')).toHaveLength(2); expect(a).toHaveLength(4); expect(a[0].status).toBe('ok'); expect(a[3].status).toBe('ok');
  });
  it('sophistication counts rare words', () => {
    expect(sophistication(tokenize('I went home'))).toBe(0);
    expect(sophistication(tokenize('the meticulous archaeologist excavated'))).toBeGreaterThan(0.5);
  });
});

const timed = (text: string, gaps: number[]): Transcript => {
  const ws = tokenize(text);
  let t = 0;
  const words = ws.map((w, i) => { const s = t; t += 0.3; const o = { word: w, start: s, end: t }; t += gaps[i] || 0.05; return o; });
  return { text, words, durationSec: t + 0.2, engine: 'groq-whisper', segments: [{ start: 0, end: t, text, avgLogprob: Math.log(0.9) }] };
};

describe('metrics', () => {
  it('computes pauses, runs and wpm from timings', () => {
    const m = computeMetrics(timed('I went to the market yesterday and bought some fresh vegetables', [0, 0, 0, 1.2, 0, 0, 0.4]));
    expect(m.pauses).toBe(2);
    expect(m.longPauses).toBe(1);
    expect(m.meanLengthOfRun).toBeCloseTo(11 / 3, 1);
    expect(m.wpm).toBeGreaterThan(80);
    expect(m.asrClarity).toBeCloseTo(0.9, 2);
  });
  it('falls back gracefully without timings', () => {
    const m = computeMetrics({ text: 'Hello I am fine thank you', durationSec: 3, engine: 'web-speech' });
    expect(m.timingAvailable).toBe(false);
    expect(m.wpm).toBeCloseTo(120, 0);
  });
  it('session metrics do not count gaps between turns as pauses', () => {
    const a = timed('one two three four', []), b = timed('five six seven eight', []);
    const m = sessionMetrics([a, b])!;
    expect(m.longPauses).toBe(0);
    expect(m.words).toBe(8);
  });
});

describe('scoring', () => {
  const said = 'Yesterday I go to market. I buyed vegetables. It was nice.';
  const corr = [
    { original: 'I go to market', corrected: 'I went to the market', natural: 'I went to the market', why: 'past', category: 'tenses' as const },
    { original: 'I buyed', corrected: 'I bought', natural: 'I bought', why: 'irregular', category: 'tenses' as const },
    { original: 'I am a robot', corrected: 'x', natural: 'x', why: 'hallucinated', category: 'other' as const },
  ];
  it('drops hallucinated corrections not present in transcript', () => {
    expect(verifyCorrections(said, corr)).toHaveLength(2);
  });
  it('grammar score from evidence', () => {
    const v = verifyCorrections(said, corr);
    const ev = grammarEvidence(said, v);
    expect(ev.errorFreeSentences).toBe(1);
    expect(grammarScore(ev)).toBeLessThan(50);
    expect(grammarScore({ errors: 0, words: 30, sentences: 3, errorFreeSentences: 3 })).toBe(100);
  });
  it('rate score does not reward speed beyond band', () => {
    expect(rateScore(140)).toBe(100);
    expect(rateScore(230)).toBe(0);
    expect(rateScore(80)).toBe(50);
  });
  it('fluency partial without timing', () => {
    const m = computeMetrics({ text: 'um um um hello', durationSec: 4, engine: 'web-speech' });
    expect(fluencyScore(m).partial).toBe(true);
  });
  it('overall renormalises over available scores', () => {
    expect(overallScore({ grammar: 80 })).toBe(80);
    expect(overallScore({ grammar: 100, fluency: 0 })).toBe(Math.round(25 / 45 * 100));
  });
  it('full session scoring', () => {
    const t = timed(said, []);
    const r = scoreSession({ transcript: said, metrics: computeMetrics(t), corrections: corr, relevance: 4 });
    expect(r.verified).toHaveLength(2);
    expect(r.scores.relevance).toBe(100);
    expect(r.scores.overall).toBeGreaterThan(0);
  });
  it('compares to previous', () => {
    expect(compareToPrevious({ overall: 70 }, [{ overall: 60 }, { overall: 50 }]).overall).toBe(15);
  });
});

describe('srs', () => {
  it('SM-2 intervals grow and reset', () => {
    let w = newWord('reliable', 'B1');
    w = review(w, 5, 0); expect(w.interval).toBe(1);
    w = review(w, 5, 0); expect(w.interval).toBe(3);
    w = review(w, 4, 0); expect(w.interval).toBeGreaterThan(3);
    w = review(w, 1, 0); expect(w.interval).toBe(1); expect(w.reps).toBe(0); expect(w.wrong).toBe(1);
    expect(w.ef).toBeGreaterThanOrEqual(1.3);
  });
});

describe('cefr', () => {
  it('needs 3 parts', () => {
    expect(estimateCefr({ speaking: [60], listening: 70 }).level).toBeNull();
  });
  it('estimates a level', () => {
    const e = estimateCefr({
      grammarQuiz: { byLevel: { A1: { correct: 3, total: 3 }, A2: { correct: 3, total: 3 }, B1: { correct: 2, total: 3 }, B2: { correct: 1, total: 3 }, C1: { correct: 0, total: 3 } } },
      vocabTest: { byLevel: { A1: { yes: 6, total: 6 }, A2: { yes: 5, total: 6 }, B1: { yes: 4, total: 6 }, B2: { yes: 2, total: 6 }, C1: { yes: 1, total: 6 } }, falseAlarms: 0, pseudoTotal: 6 },
      speaking: [55, 60], listening: 66,
    });
    expect(['B1', 'B2']).toContain(e.level);
  });
  it('grammar ladder stops at first failed level', () => {
    expect(grammarQuizScore({ A1: { correct: 0, total: 3 }, A2: { correct: 3, total: 3 } })).toBeLessThan(40);
  });
  it('vocab test penalises false alarms', () => {
    const base = { byLevel: { A1: { yes: 6, total: 6 } }, pseudoTotal: 6 };
    expect(vocabTestScore({ ...base, falseAlarms: 3 })).toBeLessThan(vocabTestScore({ ...base, falseAlarms: 0 }));
  });
});

describe('scheduler + recommender', () => {
  it('streak counts consecutive days', () => {
    const d = new Date(2026, 10, 4);
    const days = new Set([dateKey(new Date(2026, 10, 4)), dateKey(new Date(2026, 10, 3)), dateKey(new Date(2026, 10, 1))]);
    expect(computeStreak(days, d)).toBe(2);
  });
  it('pickFresh avoids recent items', () => {
    expect(pickFresh(['a', 'b', 'c'], (x) => x, new Set(['a', 'b']), 0)).toBe('c');
  });
  it('difficulty adapts', () => {
    const mk = (o: number, i: number): SessionRecord => ({ type: 'conversation', startedAt: i, durationSec: 60, speakingSec: 30, mistakeCount: 0, scores: { overall: o } });
    expect(adaptDifficulty(3, [mk(85, 1), mk(90, 2), mk(82, 3)])).toBe(4);
    expect(adaptDifficulty(3, [mk(40, 1), mk(45, 2), mk(30, 3)])).toBe(2);
    expect(adaptDifficulty(3, [mk(85, 1), mk(40, 2), mk(82, 3)])).toBe(3);
  });
  it('grammar topic prioritises real mistakes', () => {
    const now = Date.now();
    const w = analyzeWeaknesses([], [
      { sessionId: 1, ts: now, category: 'articles', original: '', corrected: '', natural: '', why: '' },
      { sessionId: 1, ts: now, category: 'articles', original: '', corrected: '', natural: '', why: '' },
      { sessionId: 1, ts: now, category: 'tenses', original: '', corrected: '', natural: '', why: '' },
    ], now);
    expect(pickGrammarTopic(['tenses', 'articles', 'prepositions'], [], w)).toBe('articles');
    const mastered = [{ topicId: 'articles', attempts: 20, correct: 19, recent: [], mastery: 95 }];
    expect(pickGrammarTopic(['tenses', 'articles', 'prepositions'], mastered, w)).toBe('tenses');
  });
});
