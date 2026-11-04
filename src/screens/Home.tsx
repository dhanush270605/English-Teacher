import { useEffect, useState } from 'preact/hooks';
import { db, getProfile, useLive } from '../services/db';
import { ensureTodayPlan, getStreak, practiceSeconds, todaysNewWords } from '../services/learning';
import { dateKey } from '../engine/scheduler';
import type { DailyTask, WordRecord } from '../types';
import { Icon } from '../ui/icons';
import { Bar, Bars, Loading } from '../ui/components';
import { go } from '../router';
import { getCategories } from '../notifications/notify';
import { speak } from '../services/speech/tts';
import { availableProviders } from '../services/ai/router';

const KIND_ICON: Record<string, string> = { vocab: 'book', grammar: 'note', speaking: 'mic', listening: 'ear', pronunciation: 'wave', picture: 'image', thinking: 'brain', revision: 'refresh', assessment: 'target', interview: 'briefcase' };

export function Home() {
  const profile = useLive(() => getProfile(), []);
  const date = dateKey();
  const tasks = useLive(() => db.tasks.where('date').equals(date).toArray(), [date]);
  const [streak, setStreak] = useState(0);
  const [word, setWord] = useState<WordRecord>();
  const [week, setWeek] = useState<{ label: string; value: number }[]>([]);
  const [reminders, setReminders] = useState<{ time: string; label: string }[]>([]);
  const [hasAI, setHasAI] = useState(true);

  useEffect(() => {
    ensureTodayPlan().catch(() => {});
    getStreak().then(setStreak);
    todaysNewWords().then((w) => setWord(w[0])).catch(() => {});
    availableProviders().then((p) => setHasAI(p.length > 0));
    practiceSeconds(7).then((d) => setWeek(d.map((x) => ({ label: 'SMTWTFS'[new Date(x.date + 'T12:00').getDay()], value: Math.round(x.total / 60) }))));
    getCategories().then((cats) => {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const list = cats.filter((c) => c.enabled && !c.weekday).flatMap((c) => c.times.map((t) => ({ time: t, label: c.label, m: +t.split(':')[0] * 60 + +t.split(':')[1] })))
        .filter((x) => x.m > cur).sort((a, b) => a.m - b.m).slice(0, 3);
      setReminders(list);
    });
  }, []);

  if (!profile || !tasks) return <div class="screen"><Loading /></div>;
  const done = tasks.filter((t) => t.status === 'done').length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const weekMin = week.reduce((a, b) => a + b.value, 0);
  const picture = tasks.find((t) => t.kind === 'picture');
  const grammar = tasks.find((t) => t.kind === 'grammar');
  const slots: DailyTask['slot'][] = ['morning', 'afternoon', 'evening'];

  return (
    <div class="screen" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div class="row between">
        <div>
          <div class="muted small">{greet}</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{profile.name || 'Learner'}</div>
        </div>
        <div class="badge accent" style={{ fontSize: 14, padding: '6px 12px' }} aria-label={`${streak} day streak`}><Icon name="flame" size={16} /> {streak} day{streak === 1 ? '' : 's'}</div>
      </div>

      {!hasAI && (
        <div class="notice info mt small">
          Add a free AI key to unlock the voice teacher and feedback. <a href="#/settings/keys">Set up in 2 minutes →</a>
        </div>
      )}

      <div class="card hero mt" style={{ padding: 18 }}>
        <div class="row between">
          <div>
            <div class="muted small">Today’s goals</div>
            <div class="big-num num">{done}/{tasks.length}</div>
          </div>
          <button class="btn white" onClick={() => go('#/teacher')}><Icon name="mic" size={18} /> Start speaking</button>
        </div>
        <div class="bar mt" style={{ background: 'rgba(255,255,255,.25)' }}><i style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`, background: '#fff' }} /></div>
        <div class="muted small mt">Level {profile.level === 'unknown' ? 'not assessed yet' : `≈ ${profile.level}`} · {profile.dailyMinutes} min/day plan</div>
      </div>

      {word && (
        <div class="card mt tap" onClick={() => go('#/vocab/learn')}>
          <div class="row between"><span class="label">Word of the day</span><span class="badge">{word.level}</span></div>
          <div class="row mt" style={{ alignItems: 'flex-start' }}>
            <div class="grow">
              <div style={{ fontSize: 22, fontWeight: 700 }}>{word.word}</div>
              <div class="small muted">{word.details ? `${word.details.ipa || ''} · ${word.details.meaning}` : 'Tap to see meaning, Tamil and examples'}</div>
            </div>
            <button class="icon-btn" aria-label="Pronounce" onClick={(e) => { e.stopPropagation(); speak(word.word, { lang: profile.accent }); }}><Icon name="volume" /></button>
          </div>
        </div>
      )}

      <div class="grid2 mt">
        <div class="tile" onClick={() => go(picture?.route || '#/picture')}>
          <div class="ico"><Icon name="image" size={20} /></div>
          <b>Picture challenge</b>
          <span>{picture ? picture.title.replace('Picture challenge: ', '') : 'Describe a scene'}</span>
        </div>
        <div class="tile" onClick={() => go(grammar?.route || '#/grammar')}>
          <div class="ico"><Icon name="note" size={20} /></div>
          <b>Grammar challenge</b>
          <span>{grammar ? grammar.title.replace('Grammar: ', '') : 'Today’s topic'}</span>
        </div>
      </div>

      <h2>Today’s plan</h2>
      {slots.map((slot) => {
        const list = tasks.filter((t) => t.slot === slot);
        if (!list.length) return null;
        return (
          <div class="mb">
            <div class="label mb" style={{ marginBottom: 6 }}>{slot}</div>
            {list.map((t) => <TaskRow t={t} />)}
          </div>
        );
      })}

      <h2>This week</h2>
      <div class="card">
        <div class="row between"><span class="small muted">Practice minutes</span><span class="small num"><b>{weekMin}</b> / {profile.weeklyGoalMinutes} min goal</span></div>
        <Bar value={(weekMin / profile.weeklyGoalMinutes) * 100} />
        <div class="mt"><Bars data={week} height={60} unit=" min" /></div>
      </div>

      {reminders.length > 0 && (
        <>
          <h2>Upcoming reminders</h2>
          <div class="card">
            {reminders.map((r) => <div class="row between small" style={{ padding: '6px 0' }}><span><Icon name="bell" size={16} /> {r.label}</span><span class="num muted">{r.time}</span></div>)}
            <button class="btn sm ghost mt" onClick={() => go('#/notifications')}>Edit reminders</button>
          </div>
        </>
      )}
    </div>
  );
}

function TaskRow({ t }: { t: DailyTask }) {
  return (
    <div class={`task ${t.status === 'done' ? 'done' : ''}`} onClick={() => go(t.route)} role="button" aria-label={`${t.title}, ${t.status}`}>
      <div class="ico"><Icon name={t.status === 'done' ? 'check' : KIND_ICON[t.kind] || 'spark'} size={20} /></div>
      <div class="grow">
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{t.title}</div>
        <div class="tiny muted">{t.minutes} min · {t.difficulty} · {t.objective}</div>
      </div>
      {t.status === 'done' && typeof t.score === 'number' ? <span class="badge good num">{t.score}</span> : <Icon name="chevron" size={18} />}
    </div>
  );
}
