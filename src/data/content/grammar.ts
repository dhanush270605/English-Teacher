// Bundled grammar curriculum (works offline, zero AI tokens). Prioritised by the learner's real mistakes.
export interface GrammarExercise { q: string; options: string[]; answer: number; explain: string }
export interface GrammarTopic {
  id: string;
  title: string;
  summary: string;
  explanation: string[];
  examples: { en: string; note?: string }[];
  mistakes: { wrong: string; right: string; why: string }[];
  tamil?: string;
  exercises: GrammarExercise[];
  produce: string; // prompt for "make your own sentences"
}

export const GRAMMAR: GrammarTopic[] = [
  {
    id: 'tenses', title: 'Tenses', summary: 'Choose the right time: present, past, future, and perfect.',
    explanation: [
      'Present simple = habits and facts: "I work in Chennai."',
      'Present continuous = happening now or temporary: "I am working on a project this week."',
      'Past simple = finished time in the past (yesterday, last year): "I joined in 2024."',
      'Present perfect = past action connected to now, no finished time: "I have finished the report."',
      'Future: "will" for decisions/predictions, "going to" for plans: "I am going to apply next week."',
    ],
    examples: [
      { en: 'I usually take the bus, but today I am walking.' },
      { en: 'She has lived here since 2020.', note: 'since + starting point' },
      { en: 'We went to Ooty last summer.' },
    ],
    mistakes: [
      { wrong: 'Yesterday I go to college.', right: 'Yesterday I went to college.', why: '“Yesterday” is finished time → past simple.' },
      { wrong: 'I am knowing him for five years.', right: 'I have known him for five years.', why: '“Know” is not used in -ing; duration until now → present perfect.' },
      { wrong: 'I have seen him yesterday.', right: 'I saw him yesterday.', why: 'Present perfect never goes with a finished time word.' },
    ],
    tamil: 'தமிழில் "நான் போறேன்" என்பது இப்போது/எதிர்காலம் இரண்டுக்கும் வரும்; ஆங்கிலத்தில் நேரத்தைத் தெளிவாகக் காட்ட வேண்டும்.',
    exercises: [
      { q: 'I ___ to the gym every morning.', options: ['go', 'am going', 'gone', 'have went'], answer: 0, explain: 'Habit → present simple.' },
      { q: 'Look! It ___ outside.', options: ['rains', 'is raining', 'rained', 'has rain'], answer: 1, explain: 'Happening now → present continuous.' },
      { q: 'We ___ the project last Friday.', options: ['have completed', 'complete', 'completed', 'are completing'], answer: 2, explain: '"Last Friday" is finished time → past simple.' },
      { q: 'I ___ my keys. I can’t open the door.', options: ['lost', 'have lost', 'am losing', 'lose'], answer: 1, explain: 'Past action with present result → present perfect.' },
      { q: 'She ___ here since 2019.', options: ['works', 'is working', 'has worked', 'worked'], answer: 2, explain: '"Since" + until now → present perfect.' },
      { q: 'Next month I ___ start a new course. I already paid.', options: ['will', 'am going to', 'would', 'was going to'], answer: 1, explain: 'A plan already decided → going to.' },
    ],
    produce: 'Write 2 sentences: one about yesterday, one about something you have done this year.',
  },
  {
    id: 'articles', title: 'Articles (a, an, the)', summary: 'When to use a, an, the – or nothing.',
    explanation: [
      '"a/an" = one of many, first mention: "I bought a phone." Use "an" before a vowel SOUND: an hour, an MBA, a university.',
      '"the" = specific, already known, or only one: "The phone I bought is fast." "the sun".',
      'No article for general plurals and uncountables: "Students need sleep." "Water is important."',
      'Jobs need a/an: "She is an engineer."',
    ],
    examples: [
      { en: 'I saw a dog. The dog was very friendly.' },
      { en: 'He is an honest person.', note: '“h” is silent → vowel sound' },
      { en: 'Life is beautiful.', note: 'general idea, no article' },
    ],
    mistakes: [
      { wrong: 'I am engineer.', right: 'I am an engineer.', why: 'Singular countable job needs a/an.' },
      { wrong: 'I went to the market and bought vegetables from shop.', right: '…bought vegetables from a shop.', why: 'Singular countable nouns cannot stand alone.' },
      { wrong: 'The life is short.', right: 'Life is short.', why: 'General abstract idea → no article.' },
    ],
    tamil: 'தமிழில் "a/an/the" போன்ற சொற்கள் இல்லை, அதனால் இவற்றை விட்டுவிடுவது பொதுவான தவறு.',
    exercises: [
      { q: 'She wants to be ___ doctor.', options: ['a', 'an', 'the', '—'], answer: 0, explain: 'Job → a/an; "doctor" starts with a consonant sound.' },
      { q: 'It took ___ hour to reach.', options: ['a', 'an', 'the', '—'], answer: 1, explain: '"hour" has a silent h → vowel sound → an.' },
      { q: '___ moon looks bright tonight.', options: ['A', 'An', 'The', '—'], answer: 2, explain: 'Only one moon → the.' },
      { q: 'I like ___ music.', options: ['a', 'an', 'the', '—'], answer: 3, explain: 'Music in general → no article.' },
      { q: 'He studies at ___ university in Vellore.', options: ['a', 'an', 'the', '—'], answer: 0, explain: '"university" starts with a "yu" sound → a.' },
      { q: 'Can you close ___ door, please?', options: ['a', 'an', 'the', '—'], answer: 2, explain: 'Both speakers know which door → the.' },
    ],
    produce: 'Describe your room in 2 sentences using a, an and the.',
  },
  {
    id: 'prepositions', title: 'Prepositions', summary: 'in / on / at, to / for, and common verb + preposition pairs.',
    explanation: [
      'Time: at 7 pm, on Monday, on 5 May, in May, in 2026, in the morning, at night.',
      'Place: at the bus stop (point), on the table (surface), in the room (inside).',
      'Movement: go to college, come home (no "to"), arrive at/in (never "arrive to").',
      'Fixed pairs: depend on, listen to, discuss (no "about"), married to, good at, interested in.',
    ],
    examples: [{ en: 'I will meet you at the station on Friday at 6.' }, { en: 'We discussed the plan.' }, { en: 'She is good at maths.' }],
    mistakes: [
      { wrong: 'We discussed about the project.', right: 'We discussed the project.', why: '“Discuss” takes a direct object.' },
      { wrong: 'I reached to Chennai.', right: 'I reached Chennai. / I arrived in Chennai.', why: '“Reach” needs no preposition.' },
      { wrong: 'He is married with my cousin.', right: 'He is married to my cousin.', why: 'Fixed pair: married to.' },
    ],
    tamil: 'தமிழில் "-இல், -க்கு" போன்ற விகுதிகள் சொல்லின் பின் வரும்; ஆங்கிலத்தில் preposition முன்னால் வரும், மேலும் ஒவ்வொரு வினைச்சொல்லுக்கும் நிலையான ஜோடி உண்டு.',
    exercises: [
      { q: 'The meeting is ___ Monday.', options: ['in', 'on', 'at', 'by'], answer: 1, explain: 'Days → on.' },
      { q: 'I was born ___ 2004.', options: ['in', 'on', 'at', 'from'], answer: 0, explain: 'Years → in.' },
      { q: 'Please listen ___ me.', options: ['—', 'at', 'to', 'for'], answer: 2, explain: 'listen to.' },
      { q: 'It depends ___ the weather.', options: ['of', 'on', 'from', 'in'], answer: 1, explain: 'depend on.' },
      { q: 'We arrived ___ the airport early.', options: ['to', 'at', 'in', 'on'], answer: 1, explain: 'arrive at (a place/point).' },
      { q: 'She is interested ___ design.', options: ['on', 'at', 'in', 'about'], answer: 2, explain: 'interested in.' },
    ],
    produce: 'Write 2 sentences about your weekly schedule using in, on and at.',
  },
  {
    id: 'pronouns', title: 'Pronouns', summary: 'he/she/it, me/my/mine, myself – and who vs which.',
    explanation: [
      'Subject: I, you, he, she, it, we, they. Object: me, him, her, us, them.',
      'Possessive: my book → the book is mine. Never "mine book".',
      'Reflexive (myself) only when subject and object are the same: "I hurt myself." Not "Myself Dhanush".',
      'Use "he/she" for people consistently; "it" for things; "they" for one person whose gender is unknown.',
    ],
    examples: [{ en: 'My name is Dhanush.' }, { en: 'This laptop is hers, not mine.' }, { en: 'Each student should bring their ID.' }],
    mistakes: [
      { wrong: 'Myself Dhanush.', right: 'I am Dhanush. / My name is Dhanush.', why: '“Myself” is reflexive, not an introduction.' },
      { wrong: 'My sister, he is a teacher.', right: 'My sister is a teacher.', why: 'Wrong gender + extra pronoun.' },
      { wrong: 'Me and my friend went.', right: 'My friend and I went.', why: 'Subject position needs “I”.' },
    ],
    exercises: [
      { q: 'This is my bag. It is ___.', options: ['my', 'mine', 'me', 'myself'], answer: 1, explain: 'Possessive pronoun alone → mine.' },
      { q: '___ and Priya are classmates.', options: ['Me', 'I', 'Myself', 'Mine'], answer: 1, explain: 'Subject → I.' },
      { q: 'He taught ___ to code.', options: ['him', 'himself', 'his', 'he'], answer: 1, explain: 'Same person → himself.' },
      { q: 'Can you help ___?', options: ['we', 'us', 'our', 'ours'], answer: 1, explain: 'Object → us.' },
      { q: 'My mother loves cooking. ___ makes great dosa.', options: ['He', 'It', 'She', 'They'], answer: 2, explain: 'Mother → she.' },
      { q: 'The phone ___ I bought is fast.', options: ['who', 'which', 'whom', 'whose'], answer: 1, explain: 'Things → which/that.' },
    ],
    produce: 'Introduce yourself and a family member in 2 sentences (no “myself”).',
  },
  {
    id: 'sva', title: 'Subject–verb agreement', summary: 'He works / they work, everyone is, the list of items is.',
    explanation: [
      'Third person singular (he, she, it, one person/thing) in present simple adds -s: "She works."',
      '"Everyone, everybody, each, nobody" are singular: "Everyone is ready."',
      'The verb agrees with the main noun, not the nearest one: "The list of names is long."',
      '"Don’t/doesn’t": he doesn’t, they don’t.',
    ],
    examples: [{ en: 'My brother lives in Bangalore.' }, { en: 'Each of the students has a laptop.' }, { en: 'The news is good.', note: '"news" is uncountable' }],
    mistakes: [
      { wrong: 'He don’t like coffee.', right: 'He doesn’t like coffee.', why: 'he → doesn’t.' },
      { wrong: 'My father work in a bank.', right: 'My father works in a bank.', why: 'Third person singular → -s.' },
      { wrong: 'Everyone have a ticket.', right: 'Everyone has a ticket.', why: '“Everyone” is singular.' },
    ],
    tamil: 'தமிழில் வினை "அவன் போகிறான் / அவர்கள் போகிறார்கள்" என மாறுவது போல, ஆங்கிலத்தில் he/she/it-க்கு மட்டும் "-s" சேரும்.',
    exercises: [
      { q: 'She ___ to music every day.', options: ['listen', 'listens', 'listening', 'are listening'], answer: 1, explain: 'she → listens.' },
      { q: 'The boxes ___ heavy.', options: ['is', 'are', 'was', 'has'], answer: 1, explain: 'Plural subject → are.' },
      { q: 'Nobody ___ the answer.', options: ['know', 'knows', 'are knowing', 'have known'], answer: 1, explain: 'Nobody = singular.' },
      { q: 'The quality of these phones ___ excellent.', options: ['are', 'is', 'were', 'have'], answer: 1, explain: 'Main noun "quality" → is.' },
      { q: 'It ___ not work.', options: ['do', 'does', 'did not', 'are'], answer: 1, explain: 'it → does.' },
      { q: 'My friends ___ in Coimbatore.', options: ['lives', 'live', 'is living', 'has lived in'], answer: 1, explain: 'Plural → live.' },
    ],
    produce: 'Write 2 sentences about what a family member does every day.',
  },
  {
    id: 'auxiliaries', title: 'Auxiliary verbs (be, do, have)', summary: 'Helping verbs for questions, negatives and tenses.',
    explanation: [
      '"be" for continuous and passive: "I am studying." "It was built."',
      '"do/does/did" for questions and negatives in simple tenses: "Did you eat?" "I didn’t go."',
      '"have/has/had" for perfect tenses: "She has finished."',
      'After did/does/do the main verb is in base form: "Did you go?" not "Did you went?"',
    ],
    examples: [{ en: 'Do you live near here?' }, { en: 'I didn’t understand the question.' }, { en: 'Has the class started?' }],
    mistakes: [
      { wrong: 'Did you went there?', right: 'Did you go there?', why: 'After “did” use the base verb.' },
      { wrong: 'I am not agree.', right: 'I don’t agree.', why: '“Agree” is a verb; negative uses do.' },
      { wrong: 'She not coming today.', right: 'She is not coming today.', why: 'Continuous needs “be”.' },
    ],
    exercises: [
      { q: '___ you like spicy food?', options: ['Are', 'Do', 'Have', 'Is'], answer: 1, explain: 'Present simple question → do.' },
      { q: 'He didn’t ___ the email.', options: ['sent', 'send', 'sends', 'sending'], answer: 1, explain: 'Base form after didn’t.' },
      { q: 'They ___ watching a film now.', options: ['is', 'are', 'do', 'have'], answer: 1, explain: 'Continuous → be (are).' },
      { q: '___ she finished her homework?', options: ['Did', 'Has', 'Is', 'Does'], answer: 1, explain: 'Perfect → has.' },
      { q: 'I ___ agree with you.', options: ['am not', 'don’t', 'not', 'haven’t'], answer: 1, explain: '"agree" is a verb → don’t.' },
      { q: 'Where ___ you go last night?', options: ['do', 'did', 'were', 'have'], answer: 1, explain: 'Past simple question → did.' },
    ],
    produce: 'Write 2 questions you could ask a new classmate.',
  },
  {
    id: 'modals', title: 'Modal verbs', summary: 'can, could, should, must, may, might, would – politeness and possibility.',
    explanation: [
      'Ability: can/could. Permission: can/may. Advice: should. Necessity: must/have to.',
      'Possibility: may/might/could. Polite requests: Could you…? Would you…?',
      'Modal + base verb, no "to": "You should go." not "You should to go."',
      'Polite: "Could you send me the file?" sounds better than "Send me the file."',
    ],
    examples: [{ en: 'Could you repeat that, please?' }, { en: 'You should practise every day.' }, { en: 'It might rain later.' }],
    mistakes: [
      { wrong: 'You should to try.', right: 'You should try.', why: 'No “to” after modals.' },
      { wrong: 'I can able to swim.', right: 'I can swim. / I am able to swim.', why: 'Use one, not both.' },
      { wrong: 'Can you give me water?', right: 'Could I have some water, please?', why: 'More polite request form.' },
    ],
    exercises: [
      { q: '___ you help me with this form?', options: ['Must', 'Could', 'Should', 'Might'], answer: 1, explain: 'Polite request → could.' },
      { q: 'You ___ see a doctor about that cough.', options: ['should', 'can', 'might', 'would'], answer: 0, explain: 'Advice → should.' },
      { q: 'I ___ finish this today. My boss needs it.', options: ['might', 'must', 'could', 'may'], answer: 1, explain: 'Strong necessity → must.' },
      { q: 'She ___ be at home; I’m not sure.', options: ['must', 'might', 'should', 'can'], answer: 1, explain: 'Uncertain possibility → might.' },
      { q: 'He can ___ three languages.', options: ['to speak', 'speaks', 'speak', 'speaking'], answer: 2, explain: 'Modal + base verb.' },
      { q: '___ I come in?', options: ['May', 'Must', 'Would', 'Should'], answer: 0, explain: 'Formal permission → may.' },
    ],
    produce: 'Write a polite request and a piece of advice for a friend.',
  },
  {
    id: 'structure', title: 'Sentence structure & word order', summary: 'Subject + verb + object, adverb position, adjective order.',
    explanation: [
      'Basic order: Subject + Verb + Object + Place + Time: "I met my friend at the café yesterday."',
      'Frequency adverbs go before the main verb but after "be": "I always walk." "She is always late."',
      'Every sentence needs a subject and a verb: "It is raining." not "Is raining."',
      'Avoid joining many clauses with "and"; split long sentences.',
    ],
    examples: [{ en: 'We usually have lunch at one.' }, { en: 'It is important to sleep well.' }, { en: 'I really enjoyed the trip.' }],
    mistakes: [
      { wrong: 'I yesterday went to Chennai.', right: 'I went to Chennai yesterday.', why: 'Time usually at the end.' },
      { wrong: 'Is very hot today.', right: 'It is very hot today.', why: 'English needs a subject (“it”).' },
      { wrong: 'I like very much cricket.', right: 'I like cricket very much.', why: 'Don’t put words between verb and object.' },
    ],
    tamil: 'தமிழ் வரிசை: எழுவாய் + செயப்படுபொருள் + வினை (நான் சோறு சாப்பிட்டேன்). ஆங்கிலம்: Subject + Verb + Object (I ate rice).',
    exercises: [
      { q: 'Choose the correct sentence.', options: ['I every day study English.', 'I study English every day.', 'Every day study I English.', 'I study every day English.'], answer: 1, explain: 'S + V + O + time.' },
      { q: 'Choose the correct sentence.', options: ['She always is late.', 'She is always late.', 'Always she late is.', 'She late always is.'], answer: 1, explain: 'Adverb after "be".' },
      { q: 'Choose the correct sentence.', options: ['Is raining.', 'It raining.', 'It is raining.', 'Raining is.'], answer: 2, explain: 'Needs subject + auxiliary.' },
      { q: 'Choose the correct sentence.', options: ['I like very much music.', 'I very much music like.', 'I like music very much.', 'Very much I like music.'], answer: 2, explain: 'Verb + object together.' },
      { q: 'Choose the correct sentence.', options: ['He never drinks coffee.', 'He drinks never coffee.', 'Never he drinks coffee.', 'He drinks coffee never.'], answer: 0, explain: 'Adverb before main verb.' },
      { q: 'Choose the correct sentence.', options: ['Yesterday in the park I my friend met.', 'I met my friend in the park yesterday.', 'I met in the park my friend yesterday.', 'My friend I met yesterday park.'], answer: 1, explain: 'S + V + O + place + time.' },
    ],
    produce: 'Write 2 sentences about your morning routine with “usually” and “sometimes”.',
  },
  {
    id: 'voice', title: 'Active and passive voice', summary: 'Focus on who does the action or on the action itself.',
    explanation: [
      'Active: The team built the app. Passive: The app was built (by the team).',
      'Passive = be + past participle. Tense is shown by "be": is made / was made / has been made / will be made.',
      'Use passive when the doer is unknown or unimportant: "My phone was stolen."',
      'In conversation prefer active – it sounds clearer and more confident.',
    ],
    examples: [{ en: 'The results will be announced tomorrow.' }, { en: 'English is spoken in many countries.' }, { en: 'I developed the backend.', note: 'active – good for interviews' }],
    mistakes: [
      { wrong: 'The project was complete by us.', right: 'We completed the project.', why: 'Wrong participle; active is clearer.' },
      { wrong: 'The bridge is build in 1990.', right: 'The bridge was built in 1990.', why: 'Past + participle “built”.' },
      { wrong: 'I was born on 2004.', right: 'I was born in 2004.', why: 'Year → in (passive “born” is correct).' },
    ],
    exercises: [
      { q: 'The cake ___ by my sister.', options: ['made', 'was made', 'was make', 'is making'], answer: 1, explain: 'be + past participle.' },
      { q: 'These cars ___ in Chennai.', options: ['are manufactured', 'manufactured', 'are manufacture', 'is manufactured'], answer: 0, explain: 'Plural present passive.' },
      { q: 'The email ___ yet.', options: ['hasn’t sent', 'hasn’t been sent', 'didn’t sent', 'isn’t send'], answer: 1, explain: 'Present perfect passive.' },
      { q: 'Active of "The match was won by India":', options: ['India won the match.', 'India was winning.', 'The match won India.', 'India has been won.'], answer: 0, explain: 'Doer becomes subject.' },
      { q: 'The new library ___ next year.', options: ['will open', 'will be opened', 'will opened', 'is open'], answer: 1, explain: 'Future passive.' },
      { q: 'My bike ___ last night.', options: ['stole', 'was stolen', 'is stolen', 'has stole'], answer: 1, explain: 'Doer unknown → passive.' },
    ],
    produce: 'Write one active and one passive sentence about a project you did.',
  },
  {
    id: 'reported', title: 'Direct and reported speech', summary: 'He said that…, she asked if…, told me to…',
    explanation: [
      'Direct: He said, "I am tired." Reported: He said (that) he was tired.',
      'Tenses usually move one step back: am → was, will → would, have done → had done.',
      'Questions become statements: "Where do you live?" → She asked where I lived. Yes/no → asked if/whether.',
      'Commands: told me to + verb: "Sit down." → He told me to sit down.',
    ],
    examples: [{ en: 'She told me that she would call later.' }, { en: 'He asked if I had eaten.' }, { en: 'The manager asked us to submit the report.' }],
    mistakes: [
      { wrong: 'He asked where do I live.', right: 'He asked where I lived.', why: 'No question order in reported questions.' },
      { wrong: 'She said me that…', right: 'She told me that… / She said that…', why: 'say something, tell someone.' },
      { wrong: 'He told to come early.', right: 'He told me to come early.', why: '“Tell” needs a person.' },
    ],
    exercises: [
      { q: '"I am busy," she said. → She said that she ___ busy.', options: ['is', 'was', 'were', 'has been'], answer: 1, explain: 'am → was.' },
      { q: '"Do you like tea?" → He asked ___ I liked tea.', options: ['do', 'that', 'if', 'what'], answer: 2, explain: 'Yes/no → if/whether.' },
      { q: 'She ___ me the truth.', options: ['said', 'told', 'spoke', 'talked'], answer: 1, explain: 'tell someone.' },
      { q: '"Close the door." → He told me ___ the door.', options: ['close', 'to close', 'closing', 'closed'], answer: 1, explain: 'told + person + to.' },
      { q: '"I will help." → He said he ___ help.', options: ['will', 'would', 'can', 'shall'], answer: 1, explain: 'will → would.' },
      { q: '"Where is the station?" → She asked where the station ___.', options: ['is it', 'was', 'did', 'does'], answer: 1, explain: 'Statement order + backshift.' },
    ],
    produce: 'Report something a friend or teacher told you this week.',
  },
  {
    id: 'conditionals', title: 'Conditionals (if)', summary: 'Real, unreal and past conditions.',
    explanation: [
      'Zero (facts): If you heat ice, it melts.',
      'First (real future): If it rains, I will stay home. (present in the if-part, never "will")',
      'Second (imaginary now): If I had more time, I would learn French.',
      'Third (imaginary past): If I had studied, I would have passed.',
    ],
    examples: [{ en: 'If you need help, call me.' }, { en: 'If I were you, I would apply.' }, { en: 'If we had left earlier, we would have caught the train.' }],
    mistakes: [
      { wrong: 'If it will rain, I will stay.', right: 'If it rains, I will stay.', why: 'No “will” in the if-clause.' },
      { wrong: 'If I would have money, I would buy it.', right: 'If I had money, I would buy it.', why: 'Second conditional uses past in if-clause.' },
      { wrong: 'If I studied, I would have passed.', right: 'If I had studied, I would have passed.', why: 'Past regret → third conditional.' },
    ],
    exercises: [
      { q: 'If you ___ hard, you will succeed.', options: ['work', 'will work', 'worked', 'would work'], answer: 0, explain: 'First conditional.' },
      { q: 'If I ___ rich, I would travel the world.', options: ['am', 'was/were', 'will be', 'have been'], answer: 1, explain: 'Second conditional.' },
      { q: 'If she had called, I ___ answered.', options: ['will have', 'would have', 'would', 'had'], answer: 1, explain: 'Third conditional.' },
      { q: 'If you mix red and blue, you ___ purple.', options: ['get', 'will got', 'would get', 'got'], answer: 0, explain: 'Fact → zero conditional.' },
      { q: 'I ___ go if you come with me.', options: ['will', 'would have', 'had', 'am'], answer: 0, explain: 'Real future → will.' },
      { q: 'If I ___ you, I would accept the offer.', options: ['am', 'were', 'will be', 'be'], answer: 1, explain: 'Advice → If I were you.' },
    ],
    produce: 'Write one first and one second conditional sentence about your career.',
  },
  {
    id: 'conjunctions', title: 'Linking words', summary: 'because, although, so, but, however – connect ideas smoothly.',
    explanation: [
      'Reason: because, since. Result: so, therefore. Contrast: but, although, however.',
      'Do NOT use "although…but" together: "Although it rained, we played."',
      '"However" starts a new sentence or follows a semicolon: "It was hard. However, we finished."',
      'Use "firstly / then / finally" to structure longer answers.',
    ],
    examples: [{ en: 'I was tired, so I went to bed early.' }, { en: 'Although the task was difficult, we finished on time.' }, { en: 'I like the city; however, the traffic is terrible.' }],
    mistakes: [
      { wrong: 'Although it was late, but I continued.', right: 'Although it was late, I continued.', why: 'Use only one contrast word.' },
      { wrong: 'Because I was sick. I stayed home.', right: 'Because I was sick, I stayed home.', why: '“Because” clause is not a full sentence.' },
      { wrong: 'I like cricket, however I don’t play.', right: 'I like cricket, but I don’t play.', why: '“However” needs a new sentence or semicolon.' },
    ],
    tamil: 'தமிழில் "ஆனாலும்…இருந்தாலும்" இரண்டையும் சேர்த்துச் சொல்வது போல ஆங்கிலத்தில் "although…but" சேர்க்கக் கூடாது.',
    exercises: [
      { q: 'I stayed home ___ it was raining.', options: ['so', 'because', 'but', 'although'], answer: 1, explain: 'Reason → because.' },
      { q: '___ he was tired, he kept working.', options: ['Because', 'So', 'Although', 'But'], answer: 2, explain: 'Contrast clause → although.' },
      { q: 'The bus was late, ___ I took an auto.', options: ['so', 'because', 'although', 'however'], answer: 0, explain: 'Result → so.' },
      { q: 'The plan is good. ___, it is expensive.', options: ['Because', 'However', 'So', 'Although'], answer: 1, explain: 'New sentence contrast → however.' },
      { q: 'Choose the correct sentence.', options: ['Although I tried, but I failed.', 'Although I tried, I failed.', 'Although I tried, so I failed.', 'Although tried, I failed but.'], answer: 1, explain: 'One contrast word.' },
      { q: 'I want to learn English ___ I can get a better job.', options: ['so that', 'although', 'but', 'however'], answer: 0, explain: 'Purpose → so that.' },
    ],
    produce: 'Write 2 sentences about your studies using “although” and “so”.',
  },
  {
    id: 'questions', title: 'Question formation', summary: 'Auxiliary before subject; indirect polite questions.',
    explanation: [
      'Yes/no: auxiliary + subject + verb: "Are you coming?" "Did she call?"',
      'Wh-questions: wh + auxiliary + subject + verb: "Where do you work?"',
      'Subject questions need no "do": "Who called you?"',
      'Polite indirect: "Could you tell me where the office is?" (statement order after the intro)',
    ],
    examples: [{ en: 'What time does the class start?' }, { en: 'Who wrote this code?' }, { en: 'Do you know if the shop is open?' }],
    mistakes: [
      { wrong: 'Where you are going?', right: 'Where are you going?', why: 'Auxiliary before subject.' },
      { wrong: 'What you did yesterday?', right: 'What did you do yesterday?', why: 'Need “did” + base verb.' },
      { wrong: 'Can you tell me where is the bank?', right: 'Can you tell me where the bank is?', why: 'Indirect question → statement order.' },
    ],
    tamil: 'தமிழில் கேள்விக்கு "-ஆ" சேர்த்தால் போதும் (நீ வருகிறாயா?). ஆங்கிலத்தில் auxiliary-ஐ subject-க்கு முன் கொண்டு வர வேண்டும்.',
    exercises: [
      { q: '___ you finish the assignment?', options: ['Do', 'Did', 'Are', 'Was'], answer: 1, explain: 'Past question → did.' },
      { q: 'Where ___ she live?', options: ['do', 'does', 'is', 'are'], answer: 1, explain: 'she → does.' },
      { q: 'Who ___ the window?', options: ['did break', 'broke', 'does broke', 'breaked'], answer: 1, explain: 'Subject question → no did.' },
      { q: 'Could you tell me what time ___?', options: ['is it', 'it is', 'does it', 'it does'], answer: 1, explain: 'Indirect → statement order.' },
      { q: 'How long ___ you been learning English?', options: ['are', 'have', 'did', 'do'], answer: 1, explain: 'Present perfect continuous → have.' },
      { q: 'Choose the correct question.', options: ['Why you are late?', 'Why are you late?', 'Why late you are?', 'Why you late?'], answer: 1, explain: 'Wh + aux + subject.' },
    ],
    produce: 'Write 3 questions you would ask an interviewer at the end of an interview.',
  },
  {
    id: 'conversational', title: 'Common conversational mistakes', summary: 'Plurals, countables and Indian-English habits that sound unnatural.',
    explanation: [
      'Uncountable nouns have no plural: information, advice, furniture, equipment, feedback, luggage.',
      '"Do the needful", "revert back", "prepone", "kindly do" sound unnatural internationally – prefer "please do what is needed", "reply", "bring forward".',
      '"I have a doubt" → "I have a question" (doubt = uncertainty).',
      'One of + plural noun: "one of my friends".',
    ],
    examples: [{ en: 'Can I ask a question about the syllabus?' }, { en: 'Thanks for the feedback.' }, { en: 'One of my friends is a designer.' }],
    mistakes: [
      { wrong: 'I have a doubt in this topic.', right: 'I have a question about this topic.', why: '“Doubt” means not believing.' },
      { wrong: 'Please give me some informations.', right: 'Please give me some information.', why: 'Uncountable.' },
      { wrong: 'Please revert back.', right: 'Please reply. / Please get back to me.', why: '“Revert” already means go back; “reply” is clearer.' },
    ],
    exercises: [
      { q: 'Can you give me some ___?', options: ['advices', 'advice', 'an advice', 'advise'], answer: 1, explain: 'Uncountable noun.' },
      { q: 'More natural: ', options: ['I have a doubt.', 'I have a question.', 'I am having doubt.', 'Doubt is there.'], answer: 1, explain: 'Question = something to ask.' },
      { q: 'One of my ___ lives in Delhi.', options: ['friend', 'friends', 'friend’s', 'friendes'], answer: 1, explain: 'one of + plural.' },
      { q: 'We bought new ___ for the office.', options: ['furnitures', 'furniture', 'a furniture', 'furnitured'], answer: 1, explain: 'Uncountable.' },
      { q: 'More natural email ending:', options: ['Please revert back.', 'Do the needful.', 'Looking forward to your reply.', 'Kindly revert.'], answer: 2, explain: 'Clear international style.' },
      { q: 'The meeting was moved earlier. Natural?', options: ['The meeting is preponed.', 'The meeting has been brought forward.', 'The meeting is advanced back.', 'The meeting is pre-moved.'], answer: 1, explain: 'International English: brought forward.' },
    ],
    produce: 'Rewrite this naturally: "Kindly do the needful and revert back."',
  },
];

export const GRAMMAR_TOPICS = GRAMMAR.map((g) => ({ id: g.id, title: g.title }));
export function getTopic(id: string) { return GRAMMAR.find((g) => g.id === id); }
