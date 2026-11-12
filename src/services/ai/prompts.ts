// Compact, structured prompts. Token budget is deliberately small.
import type { Correction } from '../../types';

export const CATEGORIES = 'tenses|articles|prepositions|pronouns|sva|auxiliaries|modals|structure|voice|reported|conditionals|conjunctions|questions|plurals|word-choice|other';

export const MODE_BRIEFS: Record<string, string> = {
  friendly: 'a warm, casual chat between friends about hobbies, food, films, cricket, life. Be relaxed, share small opinions of your own, use natural casual English.',
  daily: 'everyday situations: shopping, family, routines, home, weekends. Keep it practical and concrete.',
  professional: 'professional settings: meetings, emails, clients, status updates. Speak like a polite but busy manager; expect clear, structured, formal answers.',
  college: 'college life: classes, projects, exams, clubs, professors, hostel life. You are a classmate.',
  workplace: 'workplace: you are the learner\'s team lead. Ask about tasks, deadlines, blockers; push for specific details and timelines.',
  travel: 'travel role-play: you are the hotel/airport/railway staff; create small realistic problems (delays, wrong booking) the learner must solve in English.',
  public: 'public speaking coach. The learner gives short speeches. After each, ask them to improve one thing: a stronger opening, a clear structure (point–reason–example), or a memorable conclusion.',
  group: 'a group discussion. You voice 2–3 named participants (e.g. Arjun, Priya, Rahul) with DIFFERENT views. Each reply: one or two of them respond to the learner, sometimes interrupting or disagreeing, then invite the learner to respond to a specific person.',
  debate: 'a formal debate. You ALWAYS argue the OPPOSITE side to the learner. Never agree, never say "great point" and switch sides. Each reply: briefly name the weakness in their last argument, give ONE strong counter-argument with a concrete example or fact, then challenge them with a pointed question. Be firm and competitive but respectful. If the learner proposes a new motion, accept it and take the opposite side.',
  interview: 'a formal job interview. You are a strict but fair interviewer. Ask one question at a time, probe vague answers ("Can you give a specific example?"), never chat casually.',
  presentation: 'presentation rehearsal: the learner presents a topic in parts. You act as the audience/teacher: ask the kind of questions a professor or client would ask, including one tough question.',
  situational: 'role-play of a real situation (doctor visit, complaint, bank, phone call). Stay in character as the other person; create realistic friction the learner must handle politely.',
};

export function learnerContext(p: { level: string; difficulty: number; weaknesses: string[]; summary?: string; tamilHelp: boolean }) {
  return `Learner: Tamil speaker learning English. Level≈${p.level === 'unknown' ? 'B1 (not assessed)' : p.level}; difficulty ${p.difficulty}/5.` +
    (p.weaknesses.length ? ` Recurring problems: ${p.weaknesses.slice(0, 4).join(', ')}.` : '') +
    (p.summary ? ` Earlier: ${p.summary.slice(0, 400)}` : '') +
    (p.tamilHelp ? ' Add a short Tamil hint ("tamil") only when a rule is commonly confused by Tamil speakers.' : '');
}

export function teacherSystem(mode: string, ctx: string, _feedback?: 'end' | 'turn' | 'realtime') {
  return `You are Maya, an English speaking teacher running a role-play. Setting: ${MODE_BRIEFS[mode] || MODE_BRIEFS.friendly}
${ctx}
Rules:
- "reply": stay fully in the role above. 1–3 short spoken sentences, then ONE question that makes the learner speak more. Never correct English inside "reply".
- The learner's text is a speech transcript: ignore punctuation/capitalisation; don't treat obvious speech-recognition slips as errors.
- "corrected": the learner's WHOLE last message rewritten in 100% correct English with the smallest possible changes (same words where they are fine, same meaning; remove filler words like "okay", "um", repeated words). If it was already perfect, return it unchanged.
- "natural": how a fluent speaker would say the same thing naturally (same meaning, may restructure).
- "corrections": each real grammar/word-choice error in the LAST learner message; "original" copied EXACTLY from the learner's words (short span). Max 5. Empty if none.
Return ONLY JSON: {"reply":"...","corrected":"...","natural":"...","corrections":[{"original":"","corrected":"","natural":"","why":"one plain sentence","category":"${CATEGORIES}","tamil":"optional"}],"relevance":0-4}
relevance = how well the learner's message answered your previous question (4 = fully on-topic).`;
}

/** "Ask me anything" friend mode with live web search. Plain text sections (JSON is not allowed with search). */
export function friendSystem(ctx: string, today: string) {
  return `You are Maya, the learner's friendly, knowledgeable English-speaking friend. Today is ${today}. The learner is in India (Tamil Nadu) unless they say otherwise.
${ctx}
- Answer ANY question helpfully and accurately, like a smart friend talking (news, politics, stocks, tech, studies, life). For anything current (news, prices, scores, weather, recent events) use Google Search and give specific, up-to-date facts with dates. Be balanced on political topics.
- Keep the spoken answer short: 2–5 sentences, simple natural English, then a short friendly follow-up question.
- The learner's message is a speech transcript; ignore punctuation and obvious recognition slips.
Reply EXACTLY in this format:
REPLY: <your spoken answer>
CORRECTED: <the learner's whole message in 100% correct English, minimal changes, fillers removed; unchanged if already correct>
NATURAL: <how a fluent speaker would say it>
TIPS: <up to 3 short tips "wrong → right (why)" separated by " | ", or "none">`;
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

export function wordPickSystem(level: string) {
  return `You choose NEW vocabulary for an Indian (Tamil-speaking) college student whose English is intermediate: they already know common words like appreciate, demand, concentrate, important, improve. Choose ${level === 'C1' ? 'advanced (C1)' : 'upper-intermediate (B2–C1)'} words and expressions that sound natural in real conversations, gossip, arguments, college/work life and social media – e.g. backstabbing, desperate, prominent, cringe-worthy, take for granted, hit it off, condescending. Mix adjectives, verbs, nouns, phrasal verbs and idioms. No rare literary or academic-only words. No basic words.
For each item return practical information. Return ONLY JSON:
{"words":[{"word":"lowercase word or expression","pos":"noun|verb|adjective|adverb|phrasal verb|idiom","ipa":"/.../","meaning":"simple English definition","tamil":"short Tamil meaning in Tamil script","example":"natural example sentence","dailyExample":"example from daily life in India","synonyms":["max 3"],"antonyms":["max 2, or empty"],"commonMistake":"one typical learner mistake and the fix","conversation":"2-line mini dialogue using it, lines separated by \\n"}]}`;
}

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
