import { chat, extractJson, trimMessages, _resetRouterState, type RouterDeps } from '../../src/services/ai/router';
import { AIError, DEFAULT_AI_CONFIG, type LLMProvider } from '../../src/services/ai/types';
import { buildSchedule, buildStreakOneOffs, DEFAULT_CATEGORIES } from '../../src/notifications/notify';
import { db, getProfile, saveProfile, exportAll, clearAll } from '../../src/services/db';
import { assessConfidence, stripWhisperHallucination } from '../../src/services/speech/stt';
import { classifyHttpError } from '../../src/services/ai/providers';
import { HttpError } from '../../src/services/platform';
import { buildDailyPlan } from '../../src/engine/scheduler';
import { analyzeWeaknesses } from '../../src/engine/recommender';
import { GRAMMAR, GRAMMAR_TOPICS } from '../../src/data/content/grammar';
import { SEED_WORDS } from '../../src/data/content/words';
import { DEFAULT_PROFILE } from '../../src/services/db';

const ok = (id: 'groq' | 'gemini', text = '{"reply":"hi"}'): LLMProvider => ({ id, chat: vi.fn(async () => ({ text, tokensIn: 10, tokensOut: 5, provider: id, model: 'm' })) });
const fail = (id: 'groq' | 'gemini', err: AIError): LLMProvider => ({ id, chat: vi.fn(async () => { throw err; }) });

const deps = (p: Record<string, LLMProvider>, keys = { groq: 'k1', gemini: 'k2' }): RouterDeps => ({
  getKey: async (x) => (keys as any)[x] || '',
  providers: p as any,
  config: async () => DEFAULT_AI_CONFIG,
  online: () => true,
});

beforeEach(async () => { _resetRouterState(); await clearAll(); });

describe('AI router', () => {
  it('uses first provider', async () => {
    const g = ok('groq'), m = ok('gemini');
    const r = await chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't' }, deps({ groq: g, gemini: m }));
    expect(r.provider).toBe('groq');
    expect(m.chat).not.toHaveBeenCalled();
  });
  it('falls back on quota and records usage', async () => {
    const g = fail('groq', new AIError('quota', 'q', 60000, 'groq')), m = ok('gemini');
    const r = await chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't' }, deps({ groq: g, gemini: m }));
    expect(r.provider).toBe('gemini');
    const usage = await db.usage.toArray();
    expect(usage.find((u) => u.provider === 'groq')?.errors).toBe(1);
    // groq now cooling down: not called again
    await chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't' }, deps({ groq: g, gemini: m }));
    expect(g.chat).toHaveBeenCalledTimes(1);
  });
  it('skips providers without keys and reports no_provider', async () => {
    await expect(chat({ system: 's', messages: [], purpose: 't' }, deps({ groq: ok('groq'), gemini: ok('gemini') }, { groq: '', gemini: '' }))).rejects.toMatchObject({ kind: 'no_provider' });
  });
  it('offline error', async () => {
    const d = deps({ groq: ok('groq'), gemini: ok('gemini') }); d.online = () => false;
    await expect(chat({ system: 's', messages: [], purpose: 't' }, d)).rejects.toMatchObject({ kind: 'offline' });
  });
  it('image requests go to gemini only', async () => {
    const g = ok('groq'), m = ok('gemini');
    const r = await chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't', image: { mime: 'image/jpeg', base64: 'AA' } }, deps({ groq: g, gemini: m }));
    expect(r.provider).toBe('gemini');
  });
  it('extracts JSON from fenced/trailing-comma text', () => {
    expect(extractJson('```json\n{"a":1,}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"b":[1,2]} hope this helps')).toEqual({ b: [1, 2] });
    expect(() => extractJson('nothing')).toThrow();
  });
  it('trims history', () => {
    const m = Array.from({ length: 20 }, (_, i) => ({ role: 'user' as const, content: 'x'.repeat(i === 19 ? 3000 : 5) }));
    const t = trimMessages(m);
    expect(t).toHaveLength(8);
    expect(t[7].content.length).toBeLessThan(1600);
  });
  it('classifies http errors', () => {
    expect(classifyHttpError(new HttpError(429, { error: 'Rate limit per day' }), 'groq').kind).toBe('quota');
    expect(classifyHttpError(new HttpError(401, {}), 'gemini').kind).toBe('auth');
    expect(classifyHttpError(new HttpError(503, {}), 'gemini').kind).toBe('server');
  });
});

describe('notifications', () => {
  it('builds recurring schedule with deterministic ids and routes', () => {
    const s = buildSchedule(DEFAULT_CATEGORIES);
    expect(s.length).toBeGreaterThanOrEqual(10);
    expect(new Set(s.map((n) => n.id)).size).toBe(s.length);
    const v = s.find((n) => n.extra.category === 'vocab')!;
    expect(v.schedule!.on).toEqual({ hour: 7, minute: 15 });
    expect(v.extra.route).toBe('#/vocab/learn');
    const weekly = s.find((n) => n.extra.category === 'weekly')!;
    expect(weekly.schedule!.on!.weekday).toBe(1);
  });
  it('respects disabled categories and invalid times', () => {
    const cats = DEFAULT_CATEGORIES.map((c) => ({ ...c, enabled: c.id === 'vocab', times: c.id === 'vocab' ? ['25:00', '08:05'] : c.times }));
    const s = buildSchedule(cats);
    expect(s).toHaveLength(1);
    expect(s[0].schedule!.on).toEqual({ hour: 8, minute: 5 });
  });
  it('streak one-offs skip today when goals done', () => {
    const cat = DEFAULT_CATEGORIES.find((c) => c.id === 'streak')!;
    const now = new Date(2026, 10, 4, 9, 0);
    expect(buildStreakOneOffs(cat, false, now)).toHaveLength(3);
    expect(buildStreakOneOffs(cat, true, now)).toHaveLength(2);
    expect(buildStreakOneOffs({ ...cat, enabled: false }, false, now)).toHaveLength(0);
  });
});

describe('db', () => {
  it('profile defaults and save', async () => {
    expect((await getProfile()).wordsPerDay).toBe(5);
    await saveProfile({ name: 'Dhanush', wordsPerDay: 8 });
    const p = await getProfile();
    expect(p.name).toBe('Dhanush'); expect(p.wordsPerDay).toBe(8); expect(p.accent).toBe('en-US');
  });
  it('export excludes audio and contains tables', async () => {
    await db.sessions.add({ type: 'conversation', startedAt: 1, durationSec: 10, speakingSec: 5, mistakeCount: 0 });
    const j = JSON.parse(await exportAll());
    expect(j.sessions).toHaveLength(1);
    expect(typeof j.recordings).toBe('string');
  });
});

describe('stt confidence', () => {
  it('flags unclear segments', () => {
    const t = assessConfidence({ text: 'hello there my friend', durationSec: 3, engine: 'groq-whisper', segments: [{ start: 0, end: 3, text: 'x', avgLogprob: -1.5, noSpeechProb: 0.7 }], confidence: 0.3 });
    expect(t.lowConfidence).toBe(true);
  });
  it('accepts clear speech', () => {
    const t = assessConfidence({ text: 'I went to the market and bought vegetables', durationSec: 4, engine: 'groq-whisper', segments: [{ start: 0, end: 4, text: 'x', avgLogprob: -0.1, noSpeechProb: 0.01 }], confidence: 0.9 });
    expect(t.lowConfidence).toBe(false);
  });
  it('flags empty / silent', () => {
    expect(assessConfidence({ text: '', durationSec: 5, engine: 'groq-whisper' }).lowConfidence).toBe(true);
    expect(stripWhisperHallucination('Thank you.')).toBe('');
  });
});

describe('daily plan', () => {
  const input = (over: any = {}) => ({
    date: '2026-11-04', dayIndex: 20000, profile: { ...DEFAULT_PROFILE }, weaknesses: analyzeWeaknesses([], []),
    grammarTopics: GRAMMAR_TOPICS, grammarProgress: [], dueWords: 4, recentKeys: new Set<string>(),
    thinkingTopics: ['A', 'B'], pictureCategories: ['Nature', 'Travel'], minimalPairSets: [{ id: 'v-w', title: 'V vs W' }], listeningThemes: ['Cafe'], assessmentDue: true, ...over,
  });
  it('has every required field and all daily task types', () => {
    const plan = buildDailyPlan(input());
    const kinds = plan.map((t) => t.kind);
    for (const k of ['vocab', 'grammar', 'picture', 'listening', 'pronunciation', 'thinking', 'revision', 'assessment']) expect(kinds).toContain(k);
    for (const t of plan) { expect(t.title && t.objective && t.instructions && t.route && t.minutes > 0).toBeTruthy(); }
  });
  it('scales to daily minutes', () => {
    const p = buildDailyPlan(input({ profile: { ...DEFAULT_PROFILE, dailyMinutes: 60 }, assessmentDue: false }));
    const total = p.reduce((a, t) => a + t.minutes, 0);
    expect(total).toBeGreaterThan(50); expect(total).toBeLessThan(70);
  });
  it('avoids recently used picture category', () => {
    const p = buildDailyPlan(input({ recentKeys: new Set(['picture-cat:Nature', 'picture-cat:Travel'].slice(0, 1)) , dayIndex: 0 }));
    expect(p.find((t) => t.kind === 'picture')!.title).toContain('Travel');
  });
});

describe('content integrity', () => {
  it('every grammar exercise has a valid answer index', () => {
    for (const t of GRAMMAR) {
      expect(t.exercises.length).toBeGreaterThanOrEqual(5);
      for (const e of t.exercises) expect(e.answer).toBeLessThan(e.options.length);
    }
    expect(GRAMMAR).toHaveLength(14);
  });
  it('has enough seed words', () => { expect(SEED_WORDS.length).toBeGreaterThan(200); });
});

import { todaysNewWords } from '../../src/services/learning';
describe('vocabulary introduction', () => {
  it('concurrent calls do not exceed the daily target', async () => {
    await saveProfile({ wordsPerDay: 5, level: 'B1' });
    const [a, b, c] = await Promise.all([todaysNewWords(), todaysNewWords(), todaysNewWords()]);
    expect(a.length).toBe(5); expect(b.length).toBe(5); expect(c.length).toBe(5);
    expect(await db.words.count()).toBe(5);
  });
});
