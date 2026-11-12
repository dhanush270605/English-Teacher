// Practical vocabulary seed list (headwords only). Details (meaning, Tamil, examples…) are generated once
// by the AI in batches and cached on the device, so each word costs tokens only the first time.
// Expressive, real-life words for an intermediate learner who already knows the basics
// (people, feelings, situations, work, opinions). Common A2/B1 words are deliberately excluded.
const RAW: Record<string, string> = {
  B2: `backstabbing desperate prominent hesitant reluctant overwhelmed frustrated resentful gullible stubborn arrogant humble sarcastic sincere hypocritical manipulative straightforward clumsy cautious reckless impulsive persistent stingy generous nosy grumpy moody cheerful awkward embarrassed ashamed jealous envious grateful furious anxious exhausted thrilled devastated confused puzzled skeptical optimistic pessimistic ambitious lazy diligent reliable unreliable trustworthy dishonest loyal betray gossip brag complain whine nag flatter persuade convince hesitate procrastinate postpone cancel overthink overreact underestimate overestimate exaggerate compromise negotiate bargain apologise forgive blame criticise appreciate acknowledge admit deny confront avoid ignore tolerate cope struggle thrive juggle prioritise multitask hustle grind burnout deadline setback breakthrough milestone dilemma obstacle consequence opportunity priority routine shortcut loophole backlash outcome impact feedback criticism compliment rumour scandal controversy conspiracy hype trend viral fake genuine authentic shallow profound vague obvious subtle blunt tactful polite rude cocky shy outgoing introvert extrovert charismatic`,
  C1: `meticulous pragmatic resilient ruthless vindictive condescending pretentious complacent apathetic cynical naive gullible eloquent articulate candid tactless diplomatic assertive passive-aggressive gaslight ghost sabotage scapegoat undermine backfire overwhelm intimidate manipulate patronise exploit compensate reconcile mediate deteriorate escalate alleviate aggravate inevitable unprecedented imminent plausible far-fetched controversial contentious paradox irony hindsight foresight predicament ordeal stalemate leverage incentive accountability transparency integrity credibility bias stereotype prejudice nepotism favouritism bureaucracy red-tape loophole scrutiny backlash outrage indifference nostalgia euphoria despair resentment remorse gratitude empathy sympathy apprehension frustration relief dread`,
};

export const SEED_WORDS: { word: string; level: string }[] = Object.entries(RAW).flatMap(([level, s]) =>
  Array.from(new Set(s.split(/\s+/).filter(Boolean))).map((word) => ({ word, level })),
);

export function wordsForLevel(level: string): { word: string; level: string }[] {
  const order = ['B2', 'C1'];
  const idx = level === 'C1' || level === 'C2' ? 1 : 0;
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
