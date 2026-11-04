export type GrammarCategory =
  | 'tenses' | 'articles' | 'prepositions' | 'pronouns' | 'sva' | 'auxiliaries' | 'modals'
  | 'structure' | 'voice' | 'reported' | 'conditionals' | 'conjunctions' | 'questions'
  | 'plurals' | 'word-choice' | 'other';

export interface Correction {
  original: string;
  corrected: string;
  natural: string;
  why: string;
  category: GrammarCategory;
  practice?: string;
  tamil?: string;
}

export interface TimedWord { word: string; start: number; end: number }
export interface Segment { start: number; end: number; text: string; avgLogprob?: number; noSpeechProb?: number }

export interface Transcript {
  text: string;
  words?: TimedWord[];
  segments?: Segment[];
  durationSec: number; // recording length
  engine: 'groq-whisper' | 'gemini-audio' | 'web-speech' | 'typed';
  confidence?: number; // 0..1 when known
  lowConfidence?: boolean;
  lowConfidenceReason?: string;
}

export interface SpeechMetrics {
  words: number;
  durationSec: number;
  speakingSec: number; // first word start -> last word end (or duration)
  wpm: number; // words / speakingSec
  articulationWpm?: number; // words / phonation time (pauses removed)
  pauses?: number; // >= 0.25s
  longPauses?: number; // >= 1.0s
  longPausesPerMin?: number;
  meanLengthOfRun?: number; // words between pauses
  runLengthCV?: number;
  phonationRatio?: number;
  fillers: number;
  fillersPer100: number;
  fillerBreakdown: Record<string, number>;
  immediateRepeats: number;
  restarts: number;
  overused: { word: string; count: number }[];
  mtld: number;
  guiraud: number;
  sophistication: number;
  avgSentenceLength: number;
  subordinationPerSentence: number;
  sentenceCount: number;
  hedges: number;
  timingAvailable: boolean;
  asrClarity?: number; // 0..1 from Whisper log-probs (approximate)
}

export interface Scores {
  overall: number;
  grammar?: number;
  vocabulary?: number;
  pronunciation?: number;
  fluency?: number;
  construction?: number;
  consistency?: number;
  relevance?: number;
}

export type SessionType = 'conversation' | 'picture' | 'interview' | 'impromptu' | 'assessment' | 'listening' | 'pronunciation' | 'grammar' | 'vocab' | 'reading';

export interface SessionRecord {
  id?: number;
  type: SessionType;
  mode?: string;
  title?: string;
  startedAt: number;
  endedAt?: number;
  durationSec: number;
  speakingSec: number;
  scores?: Scores;
  metrics?: SpeechMetrics;
  mistakeCount: number;
  summary?: string;
  report?: any;
  taskId?: number;
}

export interface Turn {
  id?: number;
  sessionId: number;
  idx: number;
  role: 'user' | 'ai';
  text: string;
  ts: number;
  recordingId?: number;
  transcript?: Transcript;
  corrections?: Correction[];
  relevance?: number;
}

export interface MistakeRecord {
  id?: number;
  sessionId: number;
  ts: number;
  category: GrammarCategory;
  original: string;
  corrected: string;
  natural: string;
  why: string;
  practice?: string;
  resolved?: boolean;
}

export interface WordDetails {
  ipa?: string;
  meaning: string;
  tamil?: string;
  example: string;
  dailyExample?: string;
  synonyms?: string[];
  antonyms?: string[];
  commonMistake?: string;
  conversation?: string;
  pos?: string;
}

export interface WordRecord {
  word: string;
  level: string;
  topic?: string;
  status: 'new' | 'learning' | 'known';
  details?: WordDetails;
  ef: number;
  interval: number;
  reps: number;
  due: number;
  introducedAt?: number;
  correct: number;
  wrong: number;
  misuse: number;
}

export interface GrammarProgress {
  topicId: string;
  attempts: number;
  correct: number;
  recent: number[]; // 1/0 last 20
  mastery: number; // 0..100
  lastStudied?: number;
}

export type TaskKind = 'vocab' | 'grammar' | 'speaking' | 'listening' | 'pronunciation' | 'picture' | 'thinking' | 'revision' | 'assessment' | 'interview';

export interface DailyTask {
  id?: number;
  date: string; // YYYY-MM-DD
  kind: TaskKind;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  minutes: number;
  objective: string;
  instructions: string;
  route: string;
  refKey: string;
  status: 'pending' | 'done' | 'skipped';
  score?: number;
  slot: 'morning' | 'afternoon' | 'evening';
  completedAt?: number;
}

export interface LearnerProfile {
  name: string;
  level: string; // CEFR estimate or 'unknown'
  levelSource: 'self' | 'assessment';
  goals: string[];
  dailyMinutes: number;
  wordsPerDay: number;
  accent: 'en-US' | 'en-GB';
  feedbackMode: 'end' | 'turn' | 'realtime';
  storeRecordings: boolean;
  cloudAudioConsent: boolean;
  theme: 'system' | 'light' | 'dark';
  tamilHelp: boolean;
  difficulty: number; // 1..5 adaptive
  createdAt: number;
  onboarded: boolean;
  weeklyGoalMinutes: number;
}
