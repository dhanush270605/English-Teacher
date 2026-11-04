// Orchestration layer: daily plan, sessions, mistakes, words, grammar mastery, stats. All data comes from IndexedDB.
import type { Correction, DailyTask, GrammarProgress, MistakeRecord, SessionRecord, Transcript, WordDetails, WordRecord } from '../types';
import { db, getKV, getProfile, markUsed, recentKeys, saveProfile, setKV } from './db';
import { analyzeWeaknesses, adaptDifficulty, CATEGORY_TO_TOPIC } from '../engine/recommender';
import { buildDailyPlan, computeStreak, dateKey, dayIndexOf } from '../engine/scheduler';
import { GRAMMAR_TOPICS } from '../data/content/grammar';
import { LISTENING_THEMES, MINIMAL_PAIRS, PICTURE_CATEGORIES, THINKING_TOPICS } from '../data/content/practice';
import { wordsForLevel } from '../data/content/words';
import { newWord, isDue } from '../engine/srs';
import { chatJson } from './ai/router';
import { analysisSystem, analysisUser, learnerContext, pictureSystem, wordDetailsSystem } from './ai/prompts';
import { computeMetrics, sessionMetrics } from '../engine/metrics';
import { overallScore, scoreSession } from '../engine/scoring';
import { syncNotifications, milestone } from '../notifications/notify';
import { AIError } from './ai/types';

const DAY = 86400000;

// ---------------- Daily plan ----------------
export async function ensureTodayPlan(force = false): Promise<DailyTask[]> {
  const date = dateKey();
  const existing = await db.tasks.where('date').equals(date).toArray();
  if (existing.length && !force) return existing;
  if (existing.length && force) await db.tasks.where('date').equals(date).filter((t) => t.status === 'pending').delete();
  const profile = await getProfile();
  const sessions = await db.sessions.where('startedAt').above(Date.now() - 30 * DAY).toArray();
  const mistakes = await db.mistakes.where('ts').above(Date.now() - 30 * DAY).toArray();
  const w = analyzeWeaknesses(sessions, mistakes);
  const newDiff = adaptDifficulty(profile.difficulty, sessions);
  if (newDiff !== profile.difficulty) await saveProfile({ difficulty: newDiff });
  const lastAssess = await db.assessments.orderBy('ts').last();
  const assessmentDue = !lastAssess || Date.now() - lastAssess.ts > 7 * DAY;
  const lastGrammar = await db.tasks.orderBy(':id').reverse().filter((t) => t.kind === 'grammar' && t.date !== date).first();
  const dueWords = (await db.words.where('due').belowOrEqual(Date.now()).toArray()).filter((x) => isDue(x)).length;
  const plan = buildDailyPlan({
    date, dayIndex: dayIndexOf(), profile: { ...profile, difficulty: newDiff }, weaknesses: w,
    grammarTopics: GRAMMAR_TOPICS, grammarProgress: await db.grammar.toArray(), lastGrammarTopic: lastGrammar?.refKey?.split(':')[1],
    dueWords, recentKeys: await recentKeys(30), thinkingTopics: THINKING_TOPICS, pictureCategories: PICTURE_CATEGORIES.map((c) => c.label),
    minimalPairSets: MINIMAL_PAIRS, listeningThemes: LISTENING_THEMES, assessmentDue,
  });
  const keep = new Set(existing.map((t) => t.kind));
  const toAdd = plan.filter((t) => !keep.has(t.kind));
  await db.tasks.bulkAdd(toAdd);
  return db.tasks.where('date').equals(date).toArray();
}

/** Mark the matching pending task for today as done (by kind or route prefix). */
export async function completeTask(kind: DailyTask['kind'], score?: number) {
  const date = dateKey();
  const t = await db.tasks.where('[date+kind]').equals([date, kind]).first();
  if (t && t.status !== 'done') {
    await db.tasks.update(t.id!, { status: 'done', score, completedAt: Date.now() });
    await markUsed(t.refKey);
  }
  await markActiveToday();
  const pending = await db.tasks.where('date').equals(date).filter((x) => x.status === 'pending').count();
  if (pending === 0) { syncNotifications(true).catch(() => {}); }
}

export async function markActiveToday() {
  const days = await getKV<string[]>('activeDays', []);
  const d = dateKey();
  if (!days.includes(d)) {
    days.push(d);
    await setKV('activeDays', days.slice(-400));
    const s = computeStreak(new Set(days));
    if ([3, 7, 14, 30, 50, 100].includes(s)) milestone(`🔥 ${s}-day streak!`, 'Consistency is how fluency is built. Keep going!').catch(() => {});
  }
}

export async function getStreak(): Promise<number> {
  return computeStreak(new Set(await getKV<string[]>('activeDays', [])));
}

// ---------------- Sessions & mistakes ----------------
export async function saveSession(s: SessionRecord, corrections: Correction[] = []): Promise<number> {
  const id = await db.sessions.add({ ...s, mistakeCount: corrections.length });
  if (corrections.length) {
    await db.mistakes.bulkAdd(corrections.map((c): MistakeRecord => ({ sessionId: id, ts: s.startedAt, category: c.category || 'other', original: c.original, corrected: c.corrected, natural: c.natural || c.corrected, why: c.why, practice: c.practice })));
  }
  await markActiveToday();
  await addPracticeSeconds(s.durationSec, s.speakingSec);
  return id;
}

export async function addPracticeSeconds(total: number, speaking: number) {
  const d = dateKey();
  const k = 'practice:' + d;
  const cur = await getKV<{ total: number; speaking: number }>(k, { total: 0, speaking: 0 });
  await setKV(k, { total: cur.total + Math.round(total), speaking: cur.speaking + Math.round(speaking) });
}

export async function practiceSeconds(days: number): Promise<{ date: string; total: number; speaking: number }[]> {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dateKey(new Date(Date.now() - i * DAY));
    const v = await getKV<{ total: number; speaking: number }>('practice:' + d, { total: 0, speaking: 0 });
    out.push({ date: d, ...v });
  }
  return out;
}

export async function learnerCtx(summary?: string) {
  const p = await getProfile();
  const mistakes = await db.mistakes.where('ts').above(Date.now() - 21 * DAY).toArray();
  const w = analyzeWeaknesses([], mistakes);
  return learnerContext({ level: p.level, difficulty: p.difficulty, weaknesses: w.grammar.map((g) => g.category), summary, tamilHelp: p.tamilHelp });
}

// ---------------- Analysis (AI corrections + deterministic scores) ----------------
export interface AnalysisResult {
  scores: SessionRecord['scores'];
  metrics: SessionRecord['metrics'];
  corrections: Correction[];
  strengths: string[];
  betterExpressions: { instead: string; try: string }[];
  summary: string;
  modelAnswer?: string;
  descriptionQuality?: number;
  fluencyPartial: boolean;
  aiError?: string;
}

export async function analyzeSpeech(task: string, transcripts: Transcript[], opts: { picture?: { caption: string; image?: { mime: string; base64: string } }; readAloudAccuracy?: number; skipAI?: boolean } = {}): Promise<AnalysisResult> {
  const answers = transcripts.map((t) => t.text).filter((x) => x.trim());
  const metrics = transcripts.length > 1 ? sessionMetrics(transcripts)! : computeMetrics(transcripts[0]);
  let ai: any = { corrections: [], strengths: [], betterExpressions: [], summary: '' };
  let aiError: string | undefined;
  if (!opts.skipAI && answers.length) {
    try {
      const ctx = await learnerCtx();
      const sys = (opts.picture ? pictureSystem(!!opts.picture.image) : analysisSystem) + '\n' + ctx;
      const user = analysisUser(opts.picture ? `${task} (Picture: ${opts.picture.caption})` : task, answers);
      ai = await chatJson({ purpose: 'analysis', system: sys, messages: [{ role: 'user', content: user }], tier: 'smart', maxTokens: 1400, temperature: 0.2, image: opts.picture?.image });
    } catch (e) {
      aiError = e instanceof AIError ? e.message : 'AI analysis failed.';
      if (opts.picture?.image) {
        // retry text-only without the image (e.g. no Gemini key)
        try {
          ai = await chatJson({ purpose: 'analysis', system: pictureSystem(false), messages: [{ role: 'user', content: analysisUser(`${task} (Picture: ${opts.picture.caption})`, answers) }], tier: 'smart', maxTokens: 1400, temperature: 0.2 });
          aiError = undefined;
        } catch { /* keep error */ }
      }
    }
  }
  const relevance = typeof ai.relevance === 'number' ? ai.relevance : typeof ai.descriptionQuality === 'number' ? ai.descriptionQuality : undefined;
  const full = answers.join(' ');
  const r = scoreSession({ transcript: full, metrics, corrections: Array.isArray(ai.corrections) ? ai.corrections : [], relevance: aiError ? undefined : relevance, readAloudAccuracy: opts.readAloudAccuracy });
  if (aiError) { delete r.scores.grammar; delete r.scores.construction; r.scores.overall = recomputeOverall(r.scores); }
  return {
    scores: r.scores, metrics, corrections: r.verified,
    strengths: Array.isArray(ai.strengths) ? ai.strengths.slice(0, 3) : [],
    betterExpressions: Array.isArray(ai.betterExpressions) ? ai.betterExpressions.slice(0, 5) : [],
    summary: ai.summary || '', modelAnswer: ai.modelAnswer, descriptionQuality: ai.descriptionQuality, fluencyPartial: r.fluencyPartial, aiError,
  };
}

function recomputeOverall(s: any) { const { overall, ...rest } = s; return overallScore(rest); }

export async function previousScores(type: SessionRecord['type'], limit = 5) {
  return (await db.sessions.where('type').equals(type).reverse().sortBy('startedAt')).slice(0, limit).map((s) => s.scores!).filter(Boolean);
}

// ---------------- Vocabulary ----------------
let wordsLock: Promise<unknown> = Promise.resolve();
/** Serialised so concurrent callers (home + vocab screens) never introduce duplicate batches. */
export function todaysNewWords(): Promise<WordRecord[]> {
  const run = wordsLock.then(introduceWords, introduceWords);
  wordsLock = run.catch(() => {});
  return run;
}

async function introduceWords(): Promise<WordRecord[]> {
  const p = await getProfile();
  const today = dateKey();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const introduced = await db.words.where('introducedAt').aboveOrEqual(start.getTime()).toArray();
  if (introduced.length >= p.wordsPerDay) return introduced;
  const have = new Set((await db.words.toArray()).map((w) => w.word));
  const level = p.level === 'unknown' ? 'B1' : p.level;
  const fresh = wordsForLevel(level).filter((w) => !have.has(w.word)).slice(0, p.wordsPerDay - introduced.length);
  const rows = fresh.map((f) => ({ ...newWord(f.word, f.level), introducedAt: Date.now() }));
  if (rows.length) await db.words.bulkPut(rows);
  await setKV('wordsDate', today);
  return [...introduced, ...rows];
}

export async function ensureWordDetails(words: WordRecord[]): Promise<WordRecord[]> {
  const missing = words.filter((w) => !w.details);
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const res = await chatJson<{ words: (WordDetails & { word: string })[] }>({
      purpose: 'vocab', system: wordDetailsSystem, messages: [{ role: 'user', content: 'Words: ' + batch.map((b) => b.word).join(', ') }], tier: 'fast', maxTokens: 1800, temperature: 0.3,
    });
    for (const d of res.words || []) {
      const w = batch.find((b) => b.word.toLowerCase() === String(d.word || '').toLowerCase());
      if (!w || !d.meaning) continue;
      const details: WordDetails = {
        ipa: d.ipa, meaning: String(d.meaning).slice(0, 300), tamil: d.tamil?.slice(0, 200), example: String(d.example || '').slice(0, 300),
        dailyExample: d.dailyExample?.slice(0, 300), synonyms: (d.synonyms || []).slice(0, 3), antonyms: (d.antonyms || []).slice(0, 2),
        commonMistake: d.commonMistake?.slice(0, 300), conversation: d.conversation?.slice(0, 400), pos: d.pos,
      };
      await db.words.update(w.word, { details });
      w.details = details;
    }
  }
  return words;
}

export async function wordOfTheDay(): Promise<WordRecord | undefined> {
  const words = await todaysNewWords();
  return words[0];
}

// ---------------- Grammar mastery ----------------
export async function recordGrammarAttempt(topicId: string, results: boolean[]) {
  const cur: GrammarProgress = (await db.grammar.get(topicId)) || { topicId, attempts: 0, correct: 0, recent: [], mastery: 0 };
  const recent = [...cur.recent, ...results.map((r) => (r ? 1 : 0))].slice(-20);
  const attempts = cur.attempts + results.length;
  const correct = cur.correct + results.filter(Boolean).length;
  // Mastery = recent accuracy, penalised by unresolved real-conversation mistakes in the last 14 days.
  const cat = Object.entries(CATEGORY_TO_TOPIC).filter(([, t]) => t === topicId).map(([c]) => c);
  const convErrors = await db.mistakes.where('ts').above(Date.now() - 14 * DAY).filter((m) => cat.includes(m.category) && !m.resolved).count();
  const acc = recent.reduce((a, b) => a + b, 0) / recent.length;
  const mastery = Math.round(Math.max(0, acc * 100 - Math.min(30, convErrors * 5)));
  await db.grammar.put({ topicId, attempts, correct, recent, mastery, lastStudied: Date.now() });
  return mastery;
}

// ---------------- Stats ----------------
export async function weeklyStats(offsetWeeks = 0) {
  const end = Date.now() - offsetWeeks * 7 * DAY;
  const start = end - 7 * DAY;
  const sessions = await db.sessions.where('startedAt').between(start, end).toArray();
  const scored = sessions.filter((s) => s.scores);
  const avg = (k: string) => {
    const v = scored.map((s) => (s.scores as any)[k]).filter((x: any) => typeof x === 'number');
    return v.length ? Math.round(v.reduce((a: number, b: number) => a + b, 0) / v.length) : null;
  };
  const mistakes = await db.mistakes.where('ts').between(start, end).toArray();
  const byCat: Record<string, number> = {};
  for (const m of mistakes) byCat[m.category] = (byCat[m.category] || 0) + 1;
  const words = await db.words.toArray();
  return {
    sessions: sessions.length,
    minutes: Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / 60),
    speakingMinutes: Math.round(sessions.reduce((a, s) => a + s.speakingSec, 0) / 60),
    overall: avg('overall'), grammar: avg('grammar'), fluency: avg('fluency'), vocabulary: avg('vocabulary'), pronunciation: avg('pronunciation'),
    mistakes: mistakes.length,
    topMistakes: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5),
    wordsLearned: words.filter((w) => (w.introducedAt || 0) >= start && (w.introducedAt || 0) < end).length,
    weakWords: words.filter((w) => w.wrong > w.correct || w.misuse > 0).slice(0, 8).map((w) => w.word),
    fillersPer100: (() => { const v = scored.map((s) => s.metrics?.fillersPer100).filter((x): x is number => typeof x === 'number'); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; })(),
  };
}
