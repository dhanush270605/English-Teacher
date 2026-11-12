import { Top } from '../ui/components';
import { Icon } from '../ui/icons';

const TILES = [
  { href: '#/friend', icon: 'spark', title: 'Ask me anything', text: 'Voice chat about news, stocks, life – with live web search' },
  { href: '#/fluency', icon: 'wave', title: 'Fluency Gym', text: 'Stop pausing: 4-3-2 drill, shadowing, thinking phrases' },
  { href: '#/picture', icon: 'image', title: 'Picture speaking', text: 'Describe real photos for 30s–2 min' },
  { href: '#/interview', icon: 'briefcase', title: 'Interview trainer', text: 'HR, technical, STAR, mock interviews' },
  { href: '#/vocab/learn', icon: 'book', title: 'Vocabulary', text: 'Daily words, flashcards, quizzes' },
  { href: '#/grammar', icon: 'note', title: 'Grammar', text: '14 topics, prioritised by your mistakes' },
  { href: '#/thinking', icon: 'brain', title: 'Think in English', text: 'Impromptu talks, instant answers' },
  { href: '#/listening', icon: 'ear', title: 'Listening', text: 'Dialogues & accent practice' },
  { href: '#/pronunciation', icon: 'wave', title: 'Pronunciation', text: 'Minimal pairs, read aloud' },
  { href: '#/assessment', icon: 'target', title: 'Level assessment', text: 'Informal CEFR estimate' },
  { href: '#/timer', icon: 'timer', title: 'Practice timer', text: '5–30 min focused sessions' },
  { href: '#/mistakes', icon: 'list', title: 'Mistake dictionary', text: 'Your personal error history' },
];

export function Practice() {
  return (
    <>
      <Top title="Practice" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="grid2">
          {TILES.map((t) => (
            <a class="tile" href={t.href}>
              <div class="ico"><Icon name={t.icon} size={20} /></div>
              <b>{t.title}</b>
              <span>{t.text}</span>
            </a>
          ))}
        </div>
        <h2>Quick practice</h2>
        <a class="card tap row" href="#/thinking?quick=1" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div class="task" style={{ border: 'none', padding: 0, background: 'none' }}>
            <div class="ico"><Icon name="flame" size={20} /></div>
          </div>
          <div class="grow">
            <b>2-minute emergency practice</b>
            <div class="small muted">Before a meeting or interview – one random question, instant feedback.</div>
          </div>
          <Icon name="chevron" size={18} />
        </a>
      </div>
    </>
  );
}
