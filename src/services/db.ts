import Dexie, { type Table, liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import type { DailyTask, GrammarProgress, LearnerProfile, MistakeRecord, SessionRecord, Turn, WordRecord } from '../types';

export interface RecordingRow { id?: number; sessionId: number; blob: Blob; mime: string; durationSec: number; createdAt: number }
export interface HistoryRow { id?: number; key: string; ts: number }
export interface NotifLogRow { id?: number; ts: number; category: string; event: string }
export interface UsageRow { id: string; date: string; provider: string; requests: number; tokensIn: number; tokensOut: number; audioSec: number; errors: number }
export interface CacheRow { key: string; value: any; ts: number }
export interface AssessmentRow { id?: number; ts: number; parts: any; level: string | null; composite: number; breakdown: Record<string, number> }
export interface KV { key: string; value: any }

export class AppDB extends Dexie {
  kv!: Table<KV, string>;
  sessions!: Table<SessionRecord, number>;
  turns!: Table<Turn, number>;
  recordings!: Table<RecordingRow, number>;
  mistakes!: Table<MistakeRecord, number>;
  words!: Table<WordRecord, string>;
  grammar!: Table<GrammarProgress, string>;
  tasks!: Table<DailyTask, number>;
  history!: Table<HistoryRow, number>;
  notifLog!: Table<NotifLogRow, number>;
  usage!: Table<UsageRow, string>;
  cache!: Table<CacheRow, string>;
  assessments!: Table<AssessmentRow, number>;

  constructor(name = 'english-mastery') {
    super(name);
    this.version(1).stores({
      kv: 'key',
      sessions: '++id, type, startedAt',
      turns: '++id, sessionId, [sessionId+idx]',
      recordings: '++id, sessionId, createdAt',
      mistakes: '++id, sessionId, ts, category',
      words: 'word, status, due, introducedAt',
      grammar: 'topicId',
      tasks: '++id, date, [date+kind], status',
      history: '++id, key, ts',
      notifLog: '++id, ts',
      usage: 'id, date, provider',
      cache: 'key, ts',
      assessments: '++id, ts',
    });
  }
}

export const db = new AppDB();

export const DEFAULT_PROFILE: LearnerProfile = {
  name: '',
  level: 'unknown',
  levelSource: 'self',
  goals: ['fluency'],
  dailyMinutes: 30,
  wordsPerDay: 5,
  accent: 'en-US',
  feedbackMode: 'end',
  storeRecordings: true,
  cloudAudioConsent: false,
  theme: 'system',
  tamilHelp: true,
  difficulty: 3,
  createdAt: Date.now(),
  onboarded: false,
  weeklyGoalMinutes: 150,
};

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const r = await db.kv.get(key);
  return r ? (r.value as T) : fallback;
}
export async function setKV(key: string, value: any) {
  await db.kv.put({ key, value });
}

export async function getProfile(): Promise<LearnerProfile> {
  return { ...DEFAULT_PROFILE, ...(await getKV<Partial<LearnerProfile>>('profile', {})) };
}
export async function saveProfile(patch: Partial<LearnerProfile>) {
  const p = await getProfile();
  await setKV('profile', { ...p, ...patch });
}

export async function markUsed(key: string) {
  await db.history.add({ key, ts: Date.now() });
}
export async function recentKeys(days = 30): Promise<Set<string>> {
  const since = Date.now() - days * 86400000;
  const rows = await db.history.where('ts').above(since).toArray();
  return new Set(rows.map((r) => r.key));
}

export async function cacheGet<T>(key: string, maxAgeMs = Infinity): Promise<T | undefined> {
  const r = await db.cache.get(key);
  if (!r || Date.now() - r.ts > maxAgeMs) return undefined;
  return r.value as T;
}
export async function cacheSet(key: string, value: any) {
  await db.cache.put({ key, value, ts: Date.now() });
}

/** Deletes recordings older than `days` (audio cleanup to save storage). */
export async function cleanupRecordings(days = 14) {
  const cutoff = Date.now() - days * 86400000;
  await db.recordings.where('createdAt').below(cutoff).delete();
}

export async function exportAll(): Promise<string> {
  const out: Record<string, any> = { exportedAt: new Date().toISOString(), app: 'English Mastery', version: 1 };
  for (const t of db.tables) {
    if (t.name === 'recordings') { out.recordings = (await t.count()) + ' recordings (audio not exported)'; continue; }
    if (t.name === 'kv') { out.kv = (await db.kv.toArray()).filter((r) => !r.key.startsWith('secret:')); continue; } // never export API keys
    out[t.name] = await t.toArray();
  }
  return JSON.stringify(out, null, 1);
}

export async function clearAll() {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear(); });
}

/** Preact hook for Dexie live queries. */
export function useLive<T>(fn: () => Promise<T> | T, deps: any[] = [], initial?: T): T | undefined {
  const [v, setV] = useState<T | undefined>(initial);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({ next: setV, error: (e) => console.warn('liveQuery', e?.message) });
    return () => sub.unsubscribe();
  }, deps);
  return v;
}
