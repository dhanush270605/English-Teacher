// Initial / weekly assessment items. Level-tagged so results can be placed on an informal CEFR scale.
import type { GrammarExercise } from './grammar';

export const ASSESS_GRAMMAR: (GrammarExercise & { level: string })[] = [
  { level: 'A1', q: 'She ___ a teacher.', options: ['is', 'are', 'am', 'be'], answer: 0, explain: '' },
  { level: 'A1', q: 'I ___ two brothers.', options: ['has', 'have', 'am', 'is'], answer: 1, explain: '' },
  { level: 'A1', q: 'They ___ football on Sundays.', options: ['plays', 'play', 'playing', 'is play'], answer: 1, explain: '' },
  { level: 'A2', q: 'Yesterday we ___ to the beach.', options: ['go', 'goes', 'went', 'gone'], answer: 2, explain: '' },
  { level: 'A2', q: 'This bag is ___ than that one.', options: ['heavy', 'heavier', 'heaviest', 'more heavy'], answer: 1, explain: '' },
  { level: 'A2', q: '___ you ever been to Delhi?', options: ['Did', 'Have', 'Are', 'Do'], answer: 1, explain: '' },
  { level: 'B1', q: 'If it rains tomorrow, we ___ at home.', options: ['stay', 'will stay', 'would stay', 'stayed'], answer: 1, explain: '' },
  { level: 'B1', q: 'I have been studying English ___ three years.', options: ['since', 'for', 'from', 'during'], answer: 1, explain: '' },
  { level: 'B1', q: 'The report ___ by the manager yesterday.', options: ['wrote', 'was written', 'has written', 'is writing'], answer: 1, explain: '' },
  { level: 'B2', q: 'If I ___ about the traffic, I would have left earlier.', options: ['knew', 'had known', 'have known', 'would know'], answer: 1, explain: '' },
  { level: 'B2', q: 'She asked me where ___.', options: ['did I live', 'I lived', 'do I live', 'I do live'], answer: 1, explain: '' },
  { level: 'B2', q: 'By the time we arrived, the film ___.', options: ['started', 'has started', 'had started', 'was starting'], answer: 2, explain: '' },
  { level: 'C1', q: 'Not only ___ late, but he also forgot the documents.', options: ['he arrived', 'did he arrive', 'he did arrive', 'arrived he'], answer: 1, explain: '' },
  { level: 'C1', q: 'Had I known, I ___ differently.', options: ['would act', 'would have acted', 'acted', 'will act'], answer: 1, explain: '' },
  { level: 'C1', q: 'It’s high time we ___ a decision.', options: ['make', 'made', 'have made', 'will make'], answer: 1, explain: '' },
];

// Yes/No vocabulary test: real words by level + pseudo-words to correct for guessing.
export const VOCAB_TEST: { level: string; words: string[] }[] = [
  { level: 'A1', words: ['house', 'water', 'happy', 'friend', 'morning', 'eat'] },
  { level: 'A2', words: ['borrow', 'journey', 'polite', 'receipt', 'crowded', 'luggage'] },
  { level: 'B1', words: ['afford', 'reliable', 'colleague', 'persuade', 'deadline', 'hesitate'] },
  { level: 'B2', words: ['feasible', 'mitigate', 'coherent', 'reluctant', 'tangible', 'versatile'] },
  { level: 'C1', words: ['meticulous', 'exacerbate', 'candid', 'discern', 'tenacious', 'succinct'] },
];
export const PSEUDO_WORDS = ['plintory', 'crandle', 'mobulate', 'sprantic', 'flendish', 'glorrify'];

export const ASSESS_SPEAKING = [
  { id: 'intro', title: 'Introduce yourself', prompt: 'Introduce yourself: your name, where you are from, what you study or do, and your goals.', seconds: 60 },
  { id: 'opinion', title: 'Give an opinion', prompt: 'Do you think online learning is better than classroom learning? Explain why with examples.', seconds: 90 },
];
