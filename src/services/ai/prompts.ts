// Compact, structured prompts. Token budget is deliberately small.
import type { Correction } from '../../types';

export const CATEGORIES = 'tenses|articles|prepositions|pronouns|sva|auxiliaries|modals|structure|voice|reported|conditionals|conjunctions|questions|plurals|word-choice|other';

export const MODE_BRIEFS: Record<string, string> = {
  friendly: 'a warm, casual chat between friends about hobbies, food, films, life',
  daily: 'everyday situations: shopping, family, routines, home, weekends',
  professional: 'professional settings: meetings, emails, clients, updates, polite disagreement',
  college: 'college life: classes, projects, exams, clubs, professors, hostel life',
  workplace: 'workplace: tasks, deadlines, asking for help, reporting progress, teamwork',
  travel: 'travel: airports, trains, hotels, directions, booking, problems on a trip',
  public: 'public speaking coaching: the learner gives short speeches; you ask them to expand, structure and conclude',
  group: 'a group discussion: you play two or three participants with different views and invite the learner to contribute',
  debate: 'a debate: you take the opposite side politely, ask the learner to justify and rebut',
  interview: 'a job interview: you are the interviewer, one question at a time',
  presentation: 'presentation rehearsal: the learner presents a topic in parts; you ask audience questions',
  situational: 'role-play of a real situation (doctor visit, complaint, bank, phone call); set the scene briefly first',
};

export function learnerContext(p: { level: string; difficulty: number; weaknesses: string[]; summary?: string; tamilHelp: boolean }) {
  return `Learner: Tamil speaker learning English. Level≈${p.level === 'unknown' ? 'B1 (not assessed)' : p.level}; difficulty ${p.difficulty}/5.` +
    (p.weaknesses.length ? ` Recurring problems: ${p.weaknesses.slice(0, 4).join(', ')}.` : '') +
    (p.summary ? ` Earlier: ${p.summary.slice(0, 400)}` : '') +
    (p.tamilHelp ? ' Add a short Tamil hint ("tamil") only when a rule is commonly confused by Tamil speakers.' : '');
}

export function teacherSystem(mode: string, ctx: string, feedback: 'end' | 'turn' | 'realtime') {
  return `You are Maya, a patient, experienced English speaking teacher (not a generic chatbot). Setting: ${MODE_BRIEFS[mode] || MODE_BRIEFS.friendly}.
${ctx}
Rules:
- Reply naturally in 1–3 short spoken sentences, then ask ONE meaningful follow-up question that makes the learner speak more. Match vocabulary to the difficulty level; raise complexity slowly.
- Never lecture inside "reply". ${feedback === 'realtime' ? 'You may add one tiny gentle tip at the end of reply.' : 'Do not correct inside "reply".'}
- The learner's text is a speech transcript: ignore punctuation/capitalisation and filler words; do NOT treat obvious speech-recognition slips as grammar errors.
- In "corrections" list real grammar or word-choice errors from the LAST learner message only. "original" must be copied EXACTLY from the learner's words (short span). Max 4. Empty array if none.
Return ONLY JSON: {"reply":"...","corrections":[{"original":"","corrected":"","natural":"","why":"one plain sentence","category":"${CATEGORIES}","tamil":"optional"}],"relevance":0-4}
relevance = how well the learner's message answered your previous question (4 = fully on-topic and complete).`;
}

export function openingPrompt(mode: string) {
  return `Start the conversation for this setting. Greet me in one sentence and ask an easy first question. ${mode === 'situational' ? 'Describe the role-play scene in one sentence first.' : ''} Return JSON {"reply":"...","corrections":[],"relevance":4}`;
}

export const analysisSystem = `You are an English examiner. Analyse a learner's spoken answers (speech transcripts; ignore punctuation, capitalisation and fillers; ignore likely speech-recognition slips).
Return ONLY JSON:
{"corrections":[{"original":"exact span copied from the learner","corrected":"grammatical version","natural":"how a fluent speaker would say it","why":"one plain sentence","category":"${CATEGORIES}","practice":"one short exercise for this mistake","tamil":"optional short Tamil hint"}],
"relevance":0-4,"strengths":["max 3 short items"],"betterExpressions":[{"instead":"","try":""}],"summary":"2 sentences of encouraging, specific feedback"}
Rules: list each distinct error once (max 10), most important first. "original" MUST appear verbatim in the learner text. Do not invent errors.`;

export function analysisUser(task: string, answers: string[]) {
  return `Task given to learner: ${task}\nLearner said:\n${answers.map((a, i) => `[${i + 1}] ${a}`).join('\n')}`;
}

export function pictureSystem(hasImage: boolean) {
  return `${analysisSystem}
Also add: "modelAnswer": a natural 70–110 word description at the learner's level${hasImage ? ' based on the image' : ' based on the picture caption'}, and "descriptionQuality": 0-4 (covers people, actions, setting, prediction, opinion).`;
}

export const interviewerSystem = (kind: string, level: string, role: string) =>
  `You are a professional interviewer running a ${kind} interview (${level} level) for: ${role || 'a fresher / internship role'}. Ask ONE question at a time.
For each learner answer return ONLY JSON:
{"evaluation":{"grammar":0-4,"clarity":0-4,"relevance":0-4,"structure":0-4,"completeness":0-4,"professional":0-4,"star":{"situation":bool,"task":bool,"action":bool,"result":bool},"feedback":"2 short sentences","improvedAnswer":"the learner's own answer rewritten better, SAME meaning and facts, 60-110 words"},
"corrections":[{"original":"exact span","corrected":"","natural":"","why":"","category":"${CATEGORIES}"}],
"nextQuestion":"the next question (or a short follow-up on their answer)"}
Do not invent achievements in improvedAnswer. Only use STAR fields for behavioural questions (otherwise all false).`;

export const interviewReportSystem = `You write a concise interview performance report from per-question evaluations. Return ONLY JSON:
{"weaknesses":["max 4"],"strengths":["max 3"],"exercises":["3 specific improvement exercises"],"nextInterview":"recommended next interview type and level, one sentence"}`;

export const wordDetailsSystem = `You are an English vocabulary teacher for a Tamil-speaking adult learner. For EACH word return practical, everyday information. Return ONLY JSON:
{"words":[{"word":"","pos":"noun|verb|adjective|adverb|phrase","ipa":"/.../ (American)","meaning":"simple English definition","tamil":"short Tamil meaning in Tamil script","example":"natural example sentence","dailyExample":"example from daily life in India","synonyms":["max 3"],"antonyms":["max 2, or empty"],"commonMistake":"one typical learner mistake with this word and the fix","conversation":"a 2-line mini dialogue using the word, lines separated by \\n"}]}`;

export function wordSentenceSystem(word: string) {
  return `Evaluate whether the learner used the word "${word}" correctly and naturally in their sentence. Return ONLY JSON {"correct":bool,"natural":bool,"fixed":"corrected sentence","why":"one short sentence"}`;
}

export const grammarSentenceSystem = (topic: string) =>
  `You check sentences written by an English learner practising "${topic}". Return ONLY JSON {"results":[{"sentence":"","correct":bool,"fixed":"","why":"one short sentence"}]}`;

export const listeningSystem = (level: string, accent: string) =>
  `Write a short natural dialogue for listening practice at CEFR ${level}, ${accent === 'en-GB' ? 'British' : 'American'} English, 8–10 lines between two named speakers (A and B), everyday spoken style with contractions. Then write 4 multiple-choice comprehension questions.
Return ONLY JSON {"title":"","lines":[{"speaker":"A","name":"","text":""}],"questions":[{"q":"","options":["","","",""],"answer":0}]}`;

export const weeklyReportSystem = `You are an English coach. Using ONLY the statistics provided (do not invent numbers), write a weekly report. Return ONLY JSON:
{"improved":"1-2 sentences","remaining":"1-2 sentences naming the remaining mistake patterns","grammarToRevise":["max 3 topics"],"wordsToPractice":["max 6 words"],"fluencyChange":"1 sentence","nextWeekFocus":["3 concrete actions"]}`;

export const summarySystem = `Summarise this English practice conversation for the teacher's memory in max 60 words: topics discussed, learner's recurring errors, and what to practise next. Plain text.`;

export function correctionsForPrompt(cs: Correction[]) {
  return cs.map((c) => `${c.original} → ${c.corrected}`).join('; ');
}
