import { useEffect, useState } from 'preact/hooks';
import { Top, Spark, Bars, Bar, Loading, Empty, ScoreRing, ErrorBox } from '../ui/components';
import { Icon } from '../ui/icons';
import { db, getProfile, useLive, cacheGet, cacheSet } from '../services/db';
import { getStreak, practiceSeconds, weeklyStats } from '../services/learning';
import { chatJson, friendlyError } from '../services/ai/router';
import { weeklyReportSystem } from '../services/ai/prompts';
import { ScoreGrid, CorrectionCard, MetricsPanel } from '../ui/Report';
import { MODE_LABELS, dateKey } from '../engine/scheduler';
import { go } from '../router';
import type { SessionRecord } from '../types';

const SKILLS = ['grammar', 'vocabulary', 'pronunciation', 'fluency'] as const;

export function Progress() {
  const profile = useLive(() => getProfile(), []);
  const sessions = useLive(() => db.sessions.orderBy('startedAt').toArray(), []);
  const mistakes = useLive(() => db.mistakes.toArray(), []);
  const words = useLive(() => db.words.toArray(), []);
  const lessons = useLive(() => db.tasks.where('status').equals('done').count(), []);
  const [streak, setStreak] = useState(0);
  const [range, setRange] = useState<7 | 30>(7);
  const [daily, setDaily] = useState<{ label: string; value: number }[]>([]);
  const [speakTotal, setSpeakTotal] = useState(0);
  useEffect(() => { getStreak().then(setStreak); }, []);
  useEffect(() => {
    practiceSeconds(range === 7 ? 7 : 30).then((d) => {
      setDaily(d.map((x, i) => ({ label: range === 7 ? 'SMTWTFS'[new Date(x.date + 'T12:00').getDay()] : i % 5 === 0 ? x.date.slice(8) : '', value: Math.round(x.total / 60) })));
      setSpeakTotal(Math.round(d.reduce((a, x) => a + x.speaking, 0) / 60));
    });
  }, [range]);

  if (!profile || !sessions || !mistakes || !words) return <><Top title="Progress" /><div class="screen"><Loading /></div></>;
  const scored = sessions.filter((s) => s.scores && s.type !== 'listening' && s.type !== 'assessment');
  const now = Date.now(), D = 86400000;
  const inRange = (s: SessionRecord, from: number, to: number) => s.startedAt >= now - from * D && s.startedAt < now - to * D;
  const avg = (list: SessionRecord[], k: string) => { const v = list.map((s) => (s.scores as any)?.[k]).filter((x: any) => typeof x === 'number'); return v.length ? Math.round(v.reduce((a: number, b: number) => a + b, 0) / v.length) : null; };
  const cur = scored.filter((s) => inRange(s, range, 0)), prev = scored.filter((s) => inRange(s, range * 2, range));
  const skillNow = SKILLS.map((k) => ({ k, v: avg(cur, k), p: avg(prev, k) }));
  const have = skillNow.filter((s) => s.v !== null) as { k: string; v: number; p: number | null }[];
  const strongest = have.length ? have.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const weakest = have.length ? have.reduce((a, b) => (b.v < a.v ? b : a)) : null;
  const byCat: Record<string, number> = {};
  for (const m of mistakes.filter((m) => m.ts > now - 30 * D)) byCat[m.category] = (byCat[m.category] || 0) + 1;
  const topM = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalHours = (sessions.reduce((a, s) => a + s.durationSec, 0) / 3600).toFixed(1);
  const trend = scored.slice(-20).map((s) => s.scores!.overall);
  const overallNow = avg(cur, 'overall');

  return (
    <>
      <Top title="Progress" />
      <div class="screen" style={{ paddingTop: 4 }}>
        {!scored.length && <Empty icon="chart" title="Your progress appears here" text="Every score is calculated from your real practice sessions. Complete a conversation or picture challenge to start." action={<button class="btn" onClick={() => go('#/teacher')}>Start speaking</button>} />}
        <div class="grid3">
          <div class="card center"><div class="label">Level</div><div class="big-num" style={{ color: 'var(--accent)' }}>{profile.level === 'unknown' ? '–' : profile.level}</div><div class="tiny muted">{profile.levelSource === 'assessment' ? 'estimated' : 'not assessed'}</div></div>
          <div class="card center"><div class="label">Streak</div><div class="big-num num">{streak}</div><div class="tiny muted">days</div></div>
          <div class="card center"><div class="label">Practice</div><div class="big-num num">{totalHours}</div><div class="tiny muted">hours total</div></div>
        </div>
        <div class="chips mt">{([7, 30] as const).map((r) => <button class={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>{r === 7 ? 'This week' : 'This month'}</button>)}</div>
        {scored.length > 0 && (
          <div class="card mt">
            <div class="row" style={{ gap: 14 }}>
              <ScoreRing value={overallNow ?? undefined} label="overall*" size={84} />
              <div class="grow"><div class="label">Overall speaking score</div><div class="small muted">Average of sessions in this period{avg(prev, 'overall') !== null && overallNow !== null ? ` · ${overallNow - avg(prev, 'overall')! >= 0 ? '+' : ''}${overallNow - avg(prev, 'overall')!} vs previous` : ''}</div></div>
            </div>
            <div class="mt"><div class="label mb">Last {trend.length} sessions</div><Spark values={trend} /></div>
            <div class="tiny muted">*Overall = weighted grammar, fluency, vocabulary, construction, relevance, pronunciation.</div>
          </div>
        )}
        <h2>Skills</h2>
        <div class="card">
          {skillNow.map((s) => (
            <div style={{ marginTop: 8 }}>
              <div class="row between small"><span style={{ textTransform: 'capitalize' }}>{s.k}{s.k === 'pronunciation' ? ' (approx.)' : ''}</span><span class="num">{s.v ?? '–'}{s.v !== null && s.p !== null && <span class="muted"> ({s.v - s.p >= 0 ? '+' : ''}{s.v - s.p})</span>}</span></div>
              <Bar value={s.v ?? 0} />
            </div>
          ))}
          {strongest && weakest && strongest.k !== weakest.k && <div class="row wrap mt"><span class="badge good">Strongest: {strongest.k}</span><span class="badge warn">Focus: {weakest.k}</span></div>}
        </div>
        <h2>Practice time</h2>
        <div class="card">
          <Bars data={daily} unit=" min" />
          <div class="row between small mt"><span class="muted">Speaking time (actual voice)</span><b class="num">{speakTotal} min</b></div>
          <div class="row between small"><span class="muted">Completed lessons</span><b class="num">{lessons ?? 0}</b></div>
          <div class="row between small"><span class="muted">Words learning / known</span><b class="num">{words.filter((w) => w.status === 'learning').length} / {words.filter((w) => w.status === 'known').length}</b></div>
        </div>
        <h2>Most common mistakes (30 days)</h2>
        {topM.length ? <div class="card">{topM.map(([c, n]) => <div class="row between small" style={{ padding: '6px 0' }}><span>{c}</span><span class="badge warn">{n}</span></div>)}<button class="btn sm ghost mt" onClick={() => go('#/mistakes')}>Open mistake dictionary</button></div> : <div class="card small muted">No mistakes recorded yet.</div>}
        <div class="grid2 mt2">
          <button class="btn soft" onClick={() => go('#/weekly')}><Icon name="note" size={18} /> Weekly report</button>
          <button class="btn ghost" onClick={() => go('#/history')}><Icon name="list" size={18} /> All sessions</button>
        </div>
      </div>
    </>
  );
}

export function WeeklyReport() {
  const [stats, setStats] = useState<any>(null);
  const [prev, setPrev] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const key = 'weekly:' + dateKey().slice(0, 8) + Math.floor(new Date().getDate() / 7);
  useEffect(() => {
    (async () => {
      const s = await weeklyStats(0); setStats(s); setPrev(await weeklyStats(1));
      const cached = await cacheGet(key);
      if (cached) setAi(cached);
    })();
  }, []);
  async function generate() {
    setBusy(true); setErr('');
    try {
      const r = await chatJson({ purpose: 'weekly', system: weeklyReportSystem, messages: [{ role: 'user', content: JSON.stringify({ thisWeek: stats, lastWeek: prev }) }], tier: 'fast', maxTokens: 600 });
      setAi(r); await cacheSet(key, r);
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  }
  if (!stats) return <><Top title="Weekly report" backTo="#/progress" /><div class="screen"><Loading /></div></>;
  const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? ` (${a - b >= 0 ? '+' : ''}${a - b})` : '');
  const rows: [string, string][] = [
    ['Sessions', `${stats.sessions}`], ['Practice minutes', `${stats.minutes}`], ['Speaking minutes', `${stats.speakingMinutes}`],
    ['Overall score', `${stats.overall ?? '–'}${diff(stats.overall, prev?.overall)}`], ['Grammar', `${stats.grammar ?? '–'}${diff(stats.grammar, prev?.grammar)}`],
    ['Fluency', `${stats.fluency ?? '–'}${diff(stats.fluency, prev?.fluency)}`], ['Vocabulary', `${stats.vocabulary ?? '–'}${diff(stats.vocabulary, prev?.vocabulary)}`],
    ['Fillers / 100 words', `${stats.fillersPer100 ?? '–'}`], ['Mistakes recorded', `${stats.mistakes}`], ['New words', `${stats.wordsLearned}`],
  ];
  return (
    <>
      <Top title="Weekly report" backTo="#/progress" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card">{rows.map(([k, v]) => <div class="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><span class="muted">{k}</span><b class="num">{v}</b></div>)}</div>
        {stats.topMistakes.length > 0 && <div class="card mt small"><b>Remaining mistake patterns:</b> {stats.topMistakes.map(([c, n]: any) => `${c} (${n})`).join(', ')}</div>}
        {stats.weakWords.length > 0 && <div class="card mt small"><b>Words to practise:</b> {stats.weakWords.join(', ')}</div>}
        <h2>Coach’s summary</h2>
        {ai ? (
          <div class="card stack small">
            <div><div class="label">What improved</div>{ai.improved}</div>
            <div><div class="label">What remains</div>{ai.remaining}</div>
            {ai.grammarToRevise?.length > 0 && <div><div class="label">Grammar to revise</div>{ai.grammarToRevise.join(', ')}</div>}
            {ai.wordsToPractice?.length > 0 && <div><div class="label">Words to practise</div>{ai.wordsToPractice.join(', ')}</div>}
            <div><div class="label">Fluency</div>{ai.fluencyChange}</div>
            {ai.nextWeekFocus?.length > 0 && <div><div class="label">Next week</div>{ai.nextWeekFocus.map((x: string) => <div>• {x}</div>)}</div>}
          </div>
        ) : stats.sessions === 0 ? <div class="card small muted">No sessions this week yet.</div> : (
          <>
            {err && <ErrorBox error={err} onRetry={generate} />}
            <button class="btn block" disabled={busy} onClick={generate}>{busy ? <span class="spinner" /> : 'Write my weekly summary (AI)'}</button>
            <p class="tiny muted center">The AI only sees the statistics above – it cannot invent numbers.</p>
          </>
        )}
      </div>
    </>
  );
}

export function History() {
  const sessions = useLive(() => db.sessions.orderBy('startedAt').reverse().limit(200).toArray(), []);
  if (!sessions) return <><Top title="Sessions" backTo="#/progress" /><Loading /></>;
  return (
    <>
      <Top title="Sessions" backTo="#/progress" />
      <div class="screen" style={{ paddingTop: 4 }}>
        {!sessions.length ? <Empty title="No sessions yet" /> : <div class="card">{sessions.map((s) => (
          <a class="list-item" href={`#/session/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div class="grow"><b>{s.title || MODE_LABELS[s.mode || ''] || s.type}</b><div class="tiny muted">{new Date(s.startedAt).toLocaleString()} · {Math.round(s.durationSec / 60)} min{!s.endedAt ? ' · unfinished' : ''}</div></div>
            {s.scores && <span class="badge num">{s.scores.overall}</span>}
          </a>
        ))}</div>}
      </div>
    </>
  );
}

export function SessionView({ id }: { id: number }) {
  const s = useLive(() => db.sessions.get(id), [id]);
  const turns = useLive(() => db.turns.where('sessionId').equals(id).sortBy('idx'), [id]);
  const mistakes = useLive(() => db.mistakes.where('sessionId').equals(id).toArray(), [id]);
  const recs = useLive(() => db.recordings.where('sessionId').equals(id).toArray(), [id]);
  if (!s) return <><Top title="Session" backTo="#/history" /><Loading /></>;
  async function del() {
    await db.transaction('rw', [db.sessions, db.turns, db.mistakes, db.recordings], async () => {
      await db.turns.where('sessionId').equals(id).delete();
      await db.mistakes.where('sessionId').equals(id).delete();
      await db.recordings.where('sessionId').equals(id).delete();
      await db.sessions.delete(id);
    });
    go('#/history');
  }
  return (
    <>
      <Top title={s.title || s.type} backTo="#/history" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="small muted mb">{new Date(s.startedAt).toLocaleString()}</div>
        {s.scores && <ScoreGrid scores={s.scores} delta={s.report?.delta} fluencyPartial={s.report?.fluencyPartial} />}
        {s.report?.transcript && <><h2>Transcript</h2><div class="card small">{s.report.transcript}</div></>}
        {turns && turns.length > 0 && <><h2>Conversation</h2><div class="chat">{turns.map((t) => <div class={`bubble ${t.role === 'ai' ? 'ai' : 'me'}`}>{t.text}</div>)}</div></>}
        {recs && recs.length > 0 && (
          <><h2>Recordings ({recs.length})</h2><div class="card">{recs.map((r, i) => (
            <div class="list-item">
              <span class="grow small">Recording {i + 1} · {Math.round(r.durationSec)}s</span>
              <button class="icon-btn" aria-label="Play" onClick={() => new Audio(URL.createObjectURL(r.blob)).play()}><Icon name="play" size={18} /></button>
              <button class="icon-btn" aria-label="Delete recording" onClick={() => db.recordings.delete(r.id!)}><Icon name="trash" size={18} /></button>
            </div>
          ))}</div></>
        )}
        {mistakes && mistakes.length > 0 && <><h2>Corrections</h2><div class="stack">{mistakes.map((m) => <CorrectionCard c={m} />)}</div></>}
        {s.metrics && <><h2>Measurements</h2><MetricsPanel m={s.metrics} /></>}
        <button class="btn danger block mt2" onClick={del}><Icon name="trash" size={18} /> Delete this session</button>
      </div>
    </>
  );
}

export function Mistakes() {
  const list = useLive(() => db.mistakes.orderBy('ts').reverse().toArray(), []);
  const [cat, setCat] = useState('all');
  const [showResolved, setShowResolved] = useState(false);
  if (!list) return <><Top title="Mistake dictionary" backTo={true} /><Loading /></>;
  const cats = Array.from(new Set(list.map((m) => m.category)));
  const shown = list.filter((m) => (cat === 'all' || m.category === cat) && (showResolved || !m.resolved));
  return (
    <>
      <Top title="Mistake dictionary" backTo={true} />
      <div class="screen" style={{ paddingTop: 4 }}>
        <p class="small muted" style={{ marginTop: 0 }}>Every correction from your sessions. Mark a mistake as fixed once you can say it correctly – fixed mistakes stop affecting your grammar plan.</p>
        <div class="chips">{['all', ...cats].map((c) => <button class={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} {c !== 'all' && `(${list.filter((m) => m.category === c && !m.resolved).length})`}</button>)}</div>
        <label class="row small mt"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved((e.target as HTMLInputElement).checked)} /> Show fixed</label>
        {!shown.length ? <div class="mt"><Empty title="Nothing here" text="Great – or you haven’t practised yet." /></div> : (
          <div class="stack mt">{shown.slice(0, 150).map((m) => (
            <div>
              <CorrectionCard c={m} />
              <div class="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                <span class="tiny muted grow">{new Date(m.ts).toLocaleDateString()}</span>
                <button class="btn sm ghost" onClick={() => db.mistakes.update(m.id!, { resolved: !m.resolved })}>{m.resolved ? 'Mark as not fixed' : 'Mark as fixed'}</button>
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </>
  );
}
