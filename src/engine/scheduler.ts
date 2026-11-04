// Builds the adaptive daily plan deterministically (no AI tokens spent).
import type { DailyTask, GrammarProgress, LearnerProfile } from '../types';
import { pickGrammarTopic, recommendMode, type Weaknesses } from './recommender';

export interface PlanInput {
  date: string;
  dayIndex: number; // days since epoch – used for rotation
  profile: LearnerProfile;
  weaknesses: Weaknesses;
  grammarTopics: { id: string; title: string }[];
  grammarProgress: GrammarProgress[];
  lastGrammarTopic?: string;
  dueWords: number;
  recentKeys: Set<string>; // content used in the last 30 days
  thinkingTopics: string[];
  pictureCategories: string[];
  minimalPairSets: { id: string; title: string }[];
  listeningThemes: string[];
  assessmentDue: boolean;
}

export const MODE_LABELS: Record<string, string> = {
  friendly: 'Friendly chat', daily: 'Daily life', professional: 'Professional', college: 'College', workplace: 'Workplace',
  travel: 'Travel', public: 'Public speaking', group: 'Group discussion', debate: 'Debate', interview: 'Interview',
  presentation: 'Presentation', situational: 'Situational',
};

export function pickFresh<T>(items: T[], keyOf: (t: T) => string, recent: Set<string>, seed: number): T {
  if (!items.length) throw new Error('empty pool');
  const n = items.length;
  for (let k = 0; k < n; k++) {
    const it = items[(seed + k) % n];
    if (!recent.has(keyOf(it))) return it;
  }
  return items[seed % n];
}

const diffOf = (d: number): DailyTask['difficulty'] => (d <= 2 ? 'easy' : d === 3 ? 'medium' : 'hard');

export function buildDailyPlan(p: PlanInput): DailyTask[] {
  const w = p.weaknesses;
  const top = w.skillOrder[0];
  const base: Record<string, number> = { vocab: 4, grammar: 5, speaking: 6, listening: 4, pronunciation: 3, picture: 3, thinking: 3, revision: 4 };
  if (top === 'grammar') base.grammar *= 1.5;
  if (top === 'fluency') { base.speaking *= 1.3; base.thinking *= 1.5; }
  if (top === 'vocabulary') base.vocab *= 1.5;
  if (top === 'pronunciation') base.pronunciation *= 1.7;
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const scale = p.profile.dailyMinutes / total;
  const mins = (k: string) => Math.max(2, Math.round(base[k] * scale));
  const difficulty = diffOf(p.profile.difficulty);
  const tasks: DailyTask[] = [];
  const mk = (t: Omit<DailyTask, 'date' | 'status' | 'difficulty'> & { difficulty?: DailyTask['difficulty'] }) =>
    tasks.push({ date: p.date, status: 'pending', difficulty, ...t });

  mk({
    kind: 'vocab', slot: 'morning', minutes: mins('vocab'), title: `Learn ${p.profile.wordsPerDay} new words`,
    objective: 'Add practical everyday words to your active vocabulary.',
    instructions: 'Read each card, listen to the pronunciation, then say your own sentence with the word.',
    route: '#/vocab/learn', refKey: `vocab:${p.date}`,
  });

  const topicIds = p.grammarTopics.map((t) => t.id);
  const gt = pickGrammarTopic(topicIds, p.grammarProgress, w, p.lastGrammarTopic);
  const gTitle = p.grammarTopics.find((t) => t.id === gt)?.title || gt;
  const fromConvo = w.grammar.some((g) => g.category && gt && g.category.startsWith(gt.slice(0, 4)));
  mk({
    kind: 'grammar', slot: 'morning', minutes: mins('grammar'), title: `Grammar: ${gTitle}`,
    objective: fromConvo ? 'Fix a mistake pattern found in your own conversations.' : 'Build accuracy on a core grammar topic.',
    instructions: 'Read the short lesson, do the exercises, then write two sentences of your own.',
    route: `#/grammar/${gt}`, refKey: `grammar:${gt}`,
  });

  const interviewDay = (w.skillOrder[0] === 'interview' || p.profile.goals.includes('interviews')) && p.dayIndex % 2 === 0;
  const mode = recommendMode(w, p.profile.goals, p.dayIndex);
  if (interviewDay) {
    mk({
      kind: 'interview', slot: 'evening', minutes: mins('speaking'), title: 'Mock interview (5 questions)',
      objective: 'Answer clearly and with structure under light time pressure.',
      instructions: 'Answer one question at a time by voice. Use STAR for behavioural questions.',
      route: '#/interview', refKey: `interview:${p.date}`,
    });
  } else {
    mk({
      kind: 'speaking', slot: 'afternoon', minutes: mins('speaking'), title: `Conversation: ${MODE_LABELS[mode] || mode}`,
      objective: 'Speak continuously and naturally for several turns.',
      instructions: 'Tap the mic, speak until you finish your thought, then tap again. Corrections come at the end.',
      route: `#/teacher/${mode}`, refKey: `speaking:${mode}:${p.date}`,
    });
  }

  const cat = pickFresh(p.pictureCategories, (c) => `picture-cat:${c}`, p.recentKeys, p.dayIndex);
  mk({
    kind: 'picture', slot: 'afternoon', minutes: mins('picture'), title: `Picture challenge: ${cat}`,
    objective: 'Describe a scene: people, actions, predictions and your opinion.',
    instructions: 'Look at the picture for 10 seconds, then speak for the chosen time.',
    route: `#/picture/${encodeURIComponent(cat)}`, refKey: `picture-cat:${cat}`,
  });

  const theme = pickFresh(p.listeningThemes, (t) => `listening:${t}`, p.recentKeys, p.dayIndex);
  mk({
    kind: 'listening', slot: 'afternoon', minutes: mins('listening'), title: `Listening: ${theme}`,
    objective: 'Understand a short natural dialogue and answer questions.',
    instructions: 'Play the dialogue (you can replay once), then answer the questions.',
    route: `#/listening?theme=${encodeURIComponent(theme)}`, refKey: `listening:${theme}`,
  });

  const mp = pickFresh(p.minimalPairSets, (m) => `pron:${m.id}`, p.recentKeys, p.dayIndex);
  mk({
    kind: 'pronunciation', slot: 'evening', minutes: mins('pronunciation'), title: `Pronunciation: ${mp.title}`,
    objective: 'Hear and produce a sound contrast that is often confused.',
    instructions: 'Listen to each pair, repeat both words, and do the hearing quiz.',
    route: `#/pronunciation/${mp.id}`, refKey: `pron:${mp.id}`,
  });

  const topic = pickFresh(p.thinkingTopics, (t) => `think:${t}`, p.recentKeys, p.dayIndex * 7);
  mk({
    kind: 'thinking', slot: 'evening', minutes: mins('thinking'), title: 'Think in English: impromptu talk',
    objective: 'Start speaking quickly without translating from Tamil.',
    instructions: `Topic: “${topic}”. You get 5 seconds to think, then speak.`,
    route: `#/thinking?topic=${encodeURIComponent(topic)}`, refKey: `think:${topic}`,
  });

  mk({
    kind: 'revision', slot: 'evening', minutes: mins('revision'), title: p.dueWords ? `Revise ${p.dueWords} words` : 'Evening revision',
    objective: 'Move words into long-term memory and review today’s mistakes.',
    instructions: 'Flashcards first, then your mistake list from today.',
    route: '#/vocab/review', refKey: `revision:${p.date}`, difficulty: 'easy',
  });

  if (p.assessmentDue) {
    mk({
      kind: 'assessment', slot: 'evening', minutes: 15, title: 'Weekly speaking assessment',
      objective: 'Measure progress with the same activities every week.',
      instructions: 'Complete the 5 assessment parts. Your level estimate updates afterwards.',
      route: '#/assessment', refKey: `assessment:${p.date}`, difficulty: 'medium',
    });
  }
  return tasks;
}

export function dateKey(d = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function dayIndexOf(d = new Date()): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

/** Streak = consecutive days (ending today or yesterday) with ≥1 completed activity. */
export function computeStreak(activeDays: Set<string>, today = new Date()): number {
  let streak = 0;
  const d = new Date(today);
  if (!activeDays.has(dateKey(d))) d.setDate(d.getDate() - 1);
  while (activeDays.has(dateKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
