import { useEffect, useRef, useState } from 'preact/hooks';
import { Top, ScoreRing, fmtTime, Bars, Bar } from '../ui/components';
import { Icon } from '../ui/icons';
import { addPracticeSeconds, markActiveToday, practiceSeconds, getStreak } from '../services/learning';
import { db, getProfile, getKV, setKV, useLive } from '../services/db';
import { dateKey } from '../engine/scheduler';
import { go } from '../router';

const PRESETS = [5, 10, 15, 20, 30];

/** Focused practice timer. Time only counts while the app is visible (idle/background time is excluded). */
export function TimerScreen() {
  const [target, setTarget] = useState(10);
  const [custom, setCustom] = useState('');
  const [state, setState] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [week, setWeek] = useState<{ label: string; value: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const profile = useLive(() => getProfile(), []);
  const completed = useLive(() => db.tasks.where('date').equals(dateKey()).filter((t) => t.status === 'done').count(), []);
  const missed = useLive(() => db.tasks.where('date').below(dateKey()).filter((t) => t.status === 'pending').count(), []);
  const last = useRef(0);
  const acc = useRef(0);

  useEffect(() => {
    practiceSeconds(7).then((d) => setWeek(d.map((x) => ({ label: 'SMTWTFS'[new Date(x.date + 'T12:00').getDay()], value: Math.round(x.total / 60) }))));
    getStreak().then(setStreak);
    getKV<any>('timerState', null).then((s) => { if (s && s.date === dateKey() && s.state === 'paused') { acc.current = s.elapsed; setElapsed(s.elapsed); setTarget(s.target); setState('paused'); } });
  }, [state === 'done']);

  useEffect(() => {
    if (state !== 'running') return;
    last.current = performance.now();
    const t = setInterval(() => {
      if (document.hidden) { last.current = performance.now(); return; } // don't count idle/background time
      const now = performance.now();
      acc.current += (now - last.current) / 1000;
      last.current = now;
      setElapsed(acc.current);
      if (acc.current >= target * 60) finish();
    }, 500);
    return () => clearInterval(t);
  }, [state, target]);

  function start() { acc.current = 0; setElapsed(0); setState('running'); }
  async function pause() { setState('paused'); await setKV('timerState', { date: dateKey(), state: 'paused', elapsed: acc.current, target }); }
  function resume() { setState('running'); }
  async function finish() {
    setState('done');
    await setKV('timerState', null);
    if (acc.current >= 30) { await addPracticeSeconds(acc.current, 0); await markActiveToday(); }
  }

  const remaining = Math.max(0, target * 60 - elapsed);
  const pct = Math.min(100, (elapsed / (target * 60)) * 100);
  const weekMin = week.reduce((a, b) => a + b.value, 0);

  return (
    <>
      <Top title="Practice timer" backTo={true} />
      <div class="screen" style={{ paddingTop: 4 }}>
        {state === 'idle' && (
          <>
            <div class="label mb">Session length</div>
            <div class="chips" style={{ flexWrap: 'wrap' }}>
              {PRESETS.map((m) => <button class={`chip ${target === m && !custom ? 'on' : ''}`} onClick={() => { setTarget(m); setCustom(''); }}>{m} min</button>)}
              <input class="input" type="number" min={1} max={180} placeholder="Custom" style={{ width: 100, minHeight: 36, padding: '4px 10px' }} value={custom} onInput={(e) => { const v = (e.target as HTMLInputElement).value; setCustom(v); const n = Math.round(+v); if (n >= 1 && n <= 180) setTarget(n); }} aria-label="Custom minutes" />
            </div>
            <button class="btn block mt2" onClick={start}><Icon name="play" size={18} /> Start {target}-minute session</button>
            <p class="tiny muted">Use it alongside any activity. Time stops counting when the app is in the background. Actual speaking minutes are measured separately from your recordings.</p>
          </>
        )}
        {state !== 'idle' && (
          <div class="card center">
            <div style={{ display: 'flex', justifyContent: 'center' }}><ScoreRing value={Math.round(pct)} size={180} stroke={12} label="% done" /></div>
            <div class="big-num num mt">{fmtTime(remaining)}</div>
            <div class="small muted">remaining · {fmtTime(elapsed)} elapsed</div>
            <div class="row mt" style={{ justifyContent: 'center' }}>
              {state === 'running' && <button class="btn ghost" onClick={pause}><Icon name="pause" size={18} /> Pause</button>}
              {state === 'paused' && <button class="btn" onClick={resume}><Icon name="play" size={18} /> Resume</button>}
              {state !== 'done' && <button class="btn soft" onClick={finish}><Icon name="check" size={18} /> Finish</button>}
              {state === 'done' && <button class="btn" onClick={() => setState('idle')}>New session</button>}
            </div>
            {state === 'done' && <div class="notice good mt small">Session complete – {Math.round(elapsed / 60)} min added to today.</div>}
            {state === 'running' && <div class="row mt" style={{ justifyContent: 'center' }}><button class="btn sm ghost" onClick={() => go('#/teacher')}>Open AI teacher</button><button class="btn sm ghost" onClick={() => go('#/practice')}>Open practice</button></div>}
          </div>
        )}
        <h2>Routine</h2>
        <div class="grid3">
          <div class="card center"><div class="big-num num">{streak}</div><div class="tiny muted">day streak</div></div>
          <div class="card center"><div class="big-num num">{completed ?? 0}</div><div class="tiny muted">done today</div></div>
          <div class="card center"><div class="big-num num">{missed ?? 0}</div><div class="tiny muted">missed (past)</div></div>
        </div>
        <div class="card mt">
          <div class="row between small"><span class="muted">Weekly goal</span><span class="num"><b>{weekMin}</b> / {profile?.weeklyGoalMinutes || 150} min</span></div>
          <Bar value={(weekMin / (profile?.weeklyGoalMinutes || 150)) * 100} />
          <div class="mt"><Bars data={week} height={60} unit=" min" /></div>
        </div>
      </div>
    </>
  );
}
