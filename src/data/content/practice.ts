// Speaking topics, interview banks, picture categories, minimal pairs, listening themes.

export const THINKING_TOPICS = [
  'Describe your morning routine', 'Explain how to make your favourite dish', 'Your favourite place in your hometown', 'A skill you want to learn and why',
  'Explain a smartphone to someone from 1950', 'Is social media good or bad for students?', 'Describe the last film you watched', 'Your dream job in ten years',
  'Explain how a train ticket booking works', 'The best advice you have ever received', 'Describe a festival you celebrate', 'Online classes vs offline classes',
  'A person who inspires you', 'What would you do with one free week?', 'Explain an object on your desk', 'Should college attendance be compulsory?',
  'Describe your best friend', 'A problem in your city and a solution', 'Explain your final-year project simply', 'Your favourite season and why',
  'What makes a good team member?', 'Describe a time you helped someone', 'Explain how the internet reaches your phone', 'Cricket or football – which is better?',
  'The most useful app on your phone', 'Describe a journey you remember', 'What does success mean to you?', 'Should everyone learn to code?',
  'Describe your house to a guest', 'A habit you want to change', 'Explain a rule of a game you know', 'Is it better to live in a city or a village?',
  'Your plans for this weekend', 'Describe a teacher you remember', 'Explain artificial intelligence to a child', 'A mistake that taught you something',
  'Your favourite food and how it is made', 'Should students have part-time jobs?', 'Describe a busy market', 'What would you change about your college?',
  'Explain how to stay healthy as a student', 'A book or story you like', 'Electric vehicles – the future?', 'Describe the weather today and how it affects you',
  'Tell a story that begins: "The phone rang at midnight…"', 'Continue: "When I opened the door, I could not believe…"', 'Explain a news topic you heard this week', 'Convince me to visit Tamil Nadu',
];

export const INSTANT_QUESTIONS = [
  'What did you eat for breakfast?', 'What is your favourite colour and why?', 'How did you come to college today?', 'What are you doing this evening?',
  'What time did you wake up today?', 'Who is your favourite actor?', 'What is the last thing you bought?', 'Do you prefer tea or coffee? Why?',
  'What is your hometown famous for?', 'What did you do last Sunday?', 'What is something you are good at?', 'Which app do you use most?',
  'What makes you happy?', 'What is your plan for next year?', 'Describe your phone.', 'What is your favourite subject?',
  'If you could travel anywhere, where would you go?', 'What is one thing you learned this week?', 'Who do you talk to most every day?', 'What do you do when you feel stressed?',
];

export interface InterviewKind { id: string; label: string; behavioural?: boolean; questions: Record<'beginner' | 'intermediate' | 'advanced', string[]> }

export const INTERVIEW_KINDS: InterviewKind[] = [
  { id: 'intro', label: 'Personal introduction', questions: {
    beginner: ['Please introduce yourself.', 'Where are you from?', 'What are you studying?', 'What are your hobbies?'],
    intermediate: ['Tell me about yourself.', 'Walk me through your resume.', 'What are your strengths?', 'How would your friends describe you?'],
    advanced: ['Tell me something about yourself that is not on your resume.', 'How have your experiences prepared you for this role?', 'What is your biggest professional weakness and how are you working on it?'],
  } },
  { id: 'hr', label: 'HR interview', questions: {
    beginner: ['Why do you want this job?', 'What do you know about our company?', 'Are you willing to relocate?', 'What are your career goals?'],
    intermediate: ['Why should we hire you?', 'Where do you see yourself in five years?', 'What motivates you?', 'How do you handle pressure?'],
    advanced: ['What would you do in your first 90 days?', 'How do you decide between two good job offers?', 'What kind of manager brings out your best work?', 'Tell me about a decision you regret.'],
  } },
  { id: 'behavioural', label: 'Behavioural (STAR)', behavioural: true, questions: {
    beginner: ['Tell me about a time you worked in a team.', 'Describe a time you helped a classmate.', 'Tell me about a problem you solved.'],
    intermediate: ['Tell me about a time you faced a conflict in a team.', 'Describe a time you missed a deadline. What happened?', 'Tell me about a time you showed leadership.', 'Describe a situation where you had to learn something quickly.'],
    advanced: ['Tell me about a time you disagreed with a senior person and how you handled it.', 'Describe a failure and what you changed afterwards.', 'Tell me about a time you had to influence people without authority.', 'Describe the most complex problem you have solved.'],
  } },
  { id: 'project', label: 'Project explanation', questions: {
    beginner: ['What was your final-year project?', 'Which technologies did you use?', 'What was your role in the project?'],
    intermediate: ['Explain your best project to a non-technical person.', 'What was the most difficult part of your project?', 'How did you test your project?', 'What would you improve if you did it again?'],
    advanced: ['Walk me through the architecture of your project and the trade-offs.', 'How would your project scale to a million users?', 'What metrics proved your project worked?'],
  } },
  { id: 'technical', label: 'Technical (communication)', questions: {
    beginner: ['What is your favourite programming language and why?', 'Explain what a database is.', 'What is the internet?'],
    intermediate: ['Explain the difference between a process and a thread.', 'How does a web page load after you type a URL?', 'What is an API? Give an example.', 'Explain object-oriented programming simply.'],
    advanced: ['Explain how you would design a URL shortener.', 'How would you debug a slow web application?', 'Explain the CAP theorem with an example.', 'How do you keep an API secure?'],
  } },
  { id: 'internship', label: 'Internship interview', questions: {
    beginner: ['Why do you want this internship?', 'What do you hope to learn?', 'How many hours can you work per week?'],
    intermediate: ['What skills can you bring to our team?', 'Tell me about a course project you are proud of.', 'How do you manage studies and other work?'],
    advanced: ['What would make this internship a success for you and for us?', 'Tell me about a time you took initiative without being asked.'],
  } },
  { id: 'situational', label: 'Situational questions', questions: {
    beginner: ['What would you do if you were late for an interview?', 'What would you do if you did not understand a task?'],
    intermediate: ['A teammate is not doing their work. What would you do?', 'Your manager gives you two urgent tasks. How do you prioritise?', 'A customer is angry about a delay. How do you respond?'],
    advanced: ['You discover a serious bug one hour before a release. What do you do?', 'You strongly disagree with your team’s technical decision. How do you handle it?'],
  } },
  { id: 'gd', label: 'Group discussion topics', questions: {
    beginner: ['Is homework necessary?', 'Should mobile phones be allowed in class?'],
    intermediate: ['Work from home vs work from office.', 'Is AI a threat to jobs?', 'Should India have a four-day work week?'],
    advanced: ['Is economic growth more important than environmental protection?', 'Should social media platforms be regulated by governments?'],
  } },
];

export interface PictureCategory { id: string; label: string; queries: string[] }
// Searched live on Wikimedia Commons (free, openly licensed images, no API key).
export const PICTURE_CATEGORIES: PictureCategory[] = [
  { id: 'daily', label: 'Daily life', queries: ['people at vegetable market India', 'family dinner at home', 'street food vendor', 'people waiting at bus stop'] },
  { id: 'nature', label: 'Nature', queries: ['waterfall forest', 'paddy field farmers', 'mountain village', 'beach sunset people'] },
  { id: 'technology', label: 'Technology', queries: ['people using laptops office', 'robotics lab students', 'data center servers', 'smartphone users street'] },
  { id: 'education', label: 'Education', queries: ['classroom students India', 'university library students', 'science laboratory students', 'graduation ceremony'] },
  { id: 'business', label: 'Business', queries: ['business meeting conference room', 'startup office team', 'shopkeeper customer shop', 'trade fair stall'] },
  { id: 'transport', label: 'Transportation', queries: ['railway station platform India crowd', 'traffic jam city', 'airport terminal passengers', 'auto rickshaw street'] },
  { id: 'social', label: 'Social situations', queries: ['wedding celebration India', 'birthday party friends', 'people volunteering cleanup', 'festival crowd celebration'] },
  { id: 'workplace', label: 'Workplace', queries: ['factory workers assembly line', 'hospital doctors nurses', 'construction workers site', 'call center employees'] },
  { id: 'travel', label: 'Travel', queries: ['tourists temple India', 'backpackers hostel', 'tourists sightseeing city', 'hotel reception guests'] },
  { id: 'news', label: 'News-related', queries: ['flood rescue boat', 'election voters queue', 'protest march street', 'press conference'] },
  { id: 'abstract', label: 'Abstract images', queries: ['abstract painting colorful', 'modern art installation', 'abstract architecture'] },
  { id: 'story', label: 'Storytelling', queries: ['old man reading letter', 'child lost in crowd', 'empty chair window rain', 'friends road trip car'] },
];

export const MINIMAL_PAIRS: { id: string; title: string; tip: string; pairs: [string, string][] }[] = [
  { id: 'v-w', title: 'V vs W', tip: 'V: top teeth touch the lower lip. W: round your lips, teeth don’t touch.', pairs: [['vest', 'west'], ['vine', 'wine'], ['vet', 'wet'], ['veil', 'whale'], ['verse', 'worse']] },
  { id: 'z-j', title: 'Z vs J', tip: 'Z is a buzzing S sound; J (dʒ) starts with the tongue touching the roof.', pairs: [['zoo', 'Jew'], ['zip', 'gyp'], ['buzz', 'budge'], ['raise', 'rage']] },
  { id: 'th-t', title: 'TH vs T', tip: 'TH: tongue lightly between the teeth and blow air. T: tongue behind the teeth.', pairs: [['thin', 'tin'], ['three', 'tree'], ['thank', 'tank'], ['bath', 'bat'], ['thought', 'taught']] },
  { id: 'th-d', title: 'TH (voiced) vs D', tip: 'Voiced TH (this) vibrates with the tongue between teeth.', pairs: [['they', 'day'], ['then', 'den'], ['those', 'doze'], ['breathe', 'breed']] },
  { id: 'i-ee', title: 'Short i vs long ee', tip: 'ship = short and relaxed; sheep = long, smile slightly.', pairs: [['ship', 'sheep'], ['live', 'leave'], ['fill', 'feel'], ['bit', 'beat'], ['sit', 'seat']] },
  { id: 'e-a', title: 'e vs a (bed/bad)', tip: 'For "bad", drop your jaw more than for "bed".', pairs: [['bed', 'bad'], ['men', 'man'], ['pen', 'pan'], ['said', 'sad']] },
  { id: 's-sh', title: 'S vs SH', tip: 'SH: round lips and pull the tongue back.', pairs: [['sip', 'ship'], ['see', 'she'], ['sell', 'shell'], ['sort', 'short']] },
  { id: 'p-f', title: 'P vs F', tip: 'P: lips together, then a puff. F: top teeth on lower lip.', pairs: [['pan', 'fan'], ['pull', 'full'], ['pine', 'fine'], ['copy', 'coffee']] },
  { id: 'word-stress', title: 'Word stress', tip: 'Stress changes meaning: REcord (noun) vs reCORD (verb).', pairs: [['PREsent', 'preSENT'], ['REcord', 'reCORD'], ['OBject', 'obJECT'], ['CONtract', 'conTRACT']] },
];

export const DIFFICULT_WORDS = ['comfortable', 'vegetable', 'Wednesday', 'development', 'pronunciation', 'entrepreneur', 'schedule', 'specific', 'determine', 'hierarchy', 'colleague', 'genre', 'focus', 'women', 'world', 'clothes', 'months', 'thoroughly', 'particularly', 'rural'];

export const LISTENING_THEMES = ['At a coffee shop', 'Booking a train ticket', 'First day at a new job', 'Asking for directions', 'A job interview call', 'Planning a weekend trip', 'At the doctor', 'Returning a product', 'Group project meeting', 'Talking about a film', 'Hotel check-in', 'Ordering food by phone', 'Bank account problem', 'Meeting a new neighbour'];

export const READ_ALOUD = [
  'I usually wake up at six thirty and go for a short walk before college.',
  'Could you please send me the updated report by Thursday evening?',
  'The weather was so pleasant that we decided to have lunch outside.',
  'In my final year project, I built a web application that tracks attendance.',
  'Three thin thieves thought that they would thrive through the thick thunder.',
  'I would really appreciate it if you could give me some feedback on my presentation.',
  'Although the traffic was heavy, we reached the station on time.',
  'Very well, we will visit the village on Wednesday with the whole family.',
];
