// Personalisation: turns measured history into weakness weights and a difficulty level.
import type { GrammarCategory, GrammarProgress, MistakeRecord, SessionRecord } from '../types';

export interface Weaknesses {
  grammar: { category: GrammarCategory; per100: number; count: number }[];
  fluency: number; // 0..100 average (lower = weaker)
  vocabulary: number;
  pronunciation: number;
  interview: number;
  skillOrder: ('grammar' | 'fluency' | 'vocabulary' | 'pronunciation' | 'interview')[];
}

const DAY = 86400000;

export function analyzeWeaknesses(sessions: SessionRecord[], mistakes: MistakeRecord[], now = Date.now()): Weaknesses {
  const recent = sessions.filter((s) => s.startedAt > now - 21 * DAY && s.scores);
  const words = recent.reduce((a, s) => a + (s.metrics?.words || 0), 0) || 1;
  const recentM = mistakes.filter((m) => m.ts > now - 21 * DAY && !m.resolved);
  const byCat: Record<string, number> = {};
  for (const m of recentM) byCat[m.category] = (byCat[m.category] || 0) + 1;
  const grammar = Object.entries(byCat)
    .map(([category, count]) => ({ category: category as GrammarCategory, count, per100: (count / words) * 100 }))
    .sort((a, b) => b.count - a.count);
  const avg = (k: 'fluency' | 'vocabulary' | 'pronunciation' | 'grammar', filter?: (s: SessionRecord) => boolean) => {
    const v = recent.filter((s) => (filter ? filter(s) : true)).map((s) => s.scores?.[k]).filter((x): x is number => typeof x === 'number');
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 60; // neutral prior when no data
  };
  const interviewSessions = recent.filter((s) => s.type === 'interview');
  const interview = interviewSessions.length ? interviewSessions.reduce((a, s) => a + (s.scores?.overall || 0), 0) / interviewSessions.length : 60;
  const skills = {
    grammar: avg('grammar'),
    fluency: avg('fluency'),
    vocabulary: avg('vocabulary'),
    pronunciation: avg('pronunciation'),
    interview,
  };
  const skillOrder = (Object.keys(skills) as (keyof typeof skills)[]).sort((a, b) => skills[a] - skills[b]);
  return { grammar, fluency: skills.fluency, vocabulary: skills.vocabulary, pronunciation: skills.pronunciation, interview, skillOrder };
}

/** Adaptive difficulty 1..5: up after three strong sessions (≥80), down after three weak (≤50). */
export function adaptDifficulty(current: number, sessions: SessionRecord[]): number {
  const last = sessions.filter((s) => s.scores && (s.type === 'conversation' || s.type === 'picture' || s.type === 'impromptu' || s.type === 'interview'))
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  if (last.length < 3) return current;
  if (last.every((s) => (s.scores!.overall || 0) >= 80)) return Math.min(5, current + 1);
  if (last.every((s) => (s.scores!.overall || 0) <= 50)) return Math.max(1, current - 1);
  return current;
}

export const CATEGORY_TO_TOPIC: Record<GrammarCategory, string> = {
  tenses: 'tenses', articles: 'articles', prepositions: 'prepositions', pronouns: 'pronouns', sva: 'sva',
  auxiliaries: 'auxiliaries', modals: 'modals', structure: 'structure', voice: 'voice', reported: 'reported',
  conditionals: 'conditionals', conjunctions: 'conjunctions', questions: 'questions', plurals: 'conversational',
  'word-choice': 'conversational', other: 'conversational',
};

/** Pick the grammar topic to study: real-conversation errors first, then lowest mastery, skipping mastered (≥85). */
export function pickGrammarTopic(topicIds: string[], progress: GrammarProgress[], w: Weaknesses, lastTopic?: string): string {
  const prog = new Map(progress.map((p) => [p.topicId, p]));
  const mastered = (id: string) => (prog.get(id)?.mastery || 0) >= 85 && (prog.get(id)?.attempts || 0) >= 10;
  for (const g of w.grammar) {
    const t = CATEGORY_TO_TOPIC[g.category];
    if (t && topicIds.includes(t) && !mastered(t) && t !== lastTopic) return t;
  }
  const candidates = topicIds.filter((t) => !mastered(t) && t !== lastTopic);
  const pool = candidates.length ? candidates : topicIds;
  // Unstudied topics first (in curriculum order), then lowest mastery.
  const unstudied = pool.filter((t) => !prog.get(t));
  if (unstudied.length) return unstudied[0];
  return [...pool].sort((a, b) => (prog.get(a)?.mastery || 0) - (prog.get(b)?.mastery || 0))[0];
}

export function recommendMode(w: Weaknesses, goals: string[], dayIndex: number): string {
  if (w.skillOrder[0] === 'interview' || goals.includes('interviews')) {
    if (dayIndex % 2 === 0) return 'interview';
  }
  const rotation = ['daily', 'friendly', 'professional', 'workplace', 'college', 'situational', 'travel', 'debate', 'group', 'presentation', 'public', 'interview'];
  if (w.fluency < 55) return ['daily', 'friendly', 'situational'][dayIndex % 3];
  return rotation[dayIndex % rotation.length];
}
