// Practical vocabulary seed list (headwords only). Details (meaning, Tamil, examples…) are generated once
// by the AI in batches and cached on the device, so each word costs tokens only the first time.
const RAW: Record<string, string> = {
  A2: `appointment available borrow celebrate comfortable compare convenient crowded delay deliver describe discount earn exchange explain familiar fix forget guess improve invite journey manage mention nervous neighbour order pack polite prefer prepare receipt recommend refund remind repair reply reserve schedule share solve suggest traffic upset wait warn weekend worry`,
  B1: `achieve adapt admit afford appreciate approach arrange assume attempt attitude avoid aware balance benefit budget candidate challenge colleague commit communicate complain concern confident confirm consider contribute convince cope deadline decline demand depend deserve determine efficient encourage estimate expect experience flexible focus generous goal handle hesitate ignore impress include independent influence insist involve issue maintain manage mention motivate negotiate notice obvious opportunity organise patient persuade postpone priority promote propose punctual reasonable reduce reliable request require responsible review routine satisfy secure skill struggle succeed summary support tend update urgent valuable`,
  B2: `accomplish accurate acknowledge adequate allocate ambiguous anticipate articulate assess assumption bias brief clarify coherent collaborate compelling comprehensive concise consistent constraint crucial delegate demonstrate diligent elaborate eliminate emphasise enhance evaluate evident excel facilitate feasible feedback fluent fundamental highlight implement implication incentive initiative insight integrate interpret justify leverage milestone mitigate objective outcome overcome perspective pragmatic precise prioritise proactive prospect pursue rationale reluctant resilient resolve retain scope significant specify streamline substantial sustainable tackle tangible transparent undertake versatile viable`,
  C1: `advocate alleviate arbitrary astute candid coherent comprehend concede conscientious contentious credible deteriorate discern eloquent endorse exacerbate explicit formidable impartial inevitable intricate meticulous nuance plausible prevalent profound rigorous scrutinise succinct tenacious unprecedented`,
};

export const SEED_WORDS: { word: string; level: string }[] = Object.entries(RAW).flatMap(([level, s]) =>
  Array.from(new Set(s.split(/\s+/).filter(Boolean))).map((word) => ({ word, level })),
);

export function wordsForLevel(level: string): { word: string; level: string }[] {
  const order = ['A2', 'B1', 'B2', 'C1'];
  const idx = Math.max(0, order.indexOf(level === 'A1' ? 'A2' : level === 'C2' ? 'C1' : level));
  // current level first, then the next level, then easier words
  const pri = [order[idx], order[idx + 1], order[idx - 1], ...order].filter(Boolean);
  const seen = new Set<string>();
  const out: { word: string; level: string }[] = [];
  for (const l of pri) for (const w of SEED_WORDS) if (w.level === l && !seen.has(w.word)) { seen.add(w.word); out.push(w); }
  return out;
}

export const IDIOMS: { phrase: string; meaning: string; example: string }[] = [
  { phrase: 'break the ice', meaning: 'start a conversation in a relaxed way', example: 'I told a small joke to break the ice.' },
  { phrase: 'get the hang of', meaning: 'learn how to do something', example: 'You will get the hang of it after a week.' },
  { phrase: 'on the same page', meaning: 'agreeing / understanding the same thing', example: 'Let’s make sure we are on the same page.' },
  { phrase: 'touch base', meaning: 'contact someone briefly', example: 'Let’s touch base on Monday.' },
  { phrase: 'a piece of cake', meaning: 'very easy', example: 'The first round was a piece of cake.' },
  { phrase: 'hit the ground running', meaning: 'start quickly and effectively', example: 'I want to hit the ground running in this role.' },
  { phrase: 'think outside the box', meaning: 'think creatively', example: 'We had to think outside the box to fix the bug.' },
  { phrase: 'cut corners', meaning: 'do something badly to save time or money', example: 'We didn’t cut corners on testing.' },
  { phrase: 'go the extra mile', meaning: 'do more than expected', example: 'She always goes the extra mile for customers.' },
  { phrase: 'keep me posted', meaning: 'tell me the latest news', example: 'Keep me posted about the results.' },
];
