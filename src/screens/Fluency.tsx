// Fluency Gym – drills that target slow speech and long pauses. All scoring is local (zero AI tokens).
import { useState } from 'preact/hooks';
import type { SpeechMetrics } from '../types';
import { Top, Segmented } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { INSTANT_QUESTIONS, SHADOWING_TEXTS, THINKING_PHRASES, THINKING_TOPICS } from '../data/content/practice';
import { computeMetrics } from '../engine/metrics';
import { fluencyScore } from '../engine/scoring';
import { alignWords, normalize, tokenize } from '../engine/text';
import { addPracticeSeconds, markActiveToday, saveSession } from '../services/learning';
import { speak, stopSpeaking } from '../services/speech/tts';

type Tab = '432' | 'shadow' | 'phrases';
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function Fluency() {
  const [tab, setTab] = useState<Tab>((new URLSearchParams(location.hash.split('?')[1] || '').get('tab') as Tab) || '432');
  return (
    <>
      <Top title="Fluency Gym" backTo={true} />
      <div class="screen no-nav" style={{ paddingTop: 4 }}>
        <Segmented value={tab} onChange={(t) => { stopSpeaking(); setTab(t); }} options={[{ value: '432', label: '4-3-2 drill' }, { value: 'shadow', label: 'Shadowing' }, { value: 'phrases', label: 'Thinking phrases' }]} />
        <div class="mt">{tab === '432' ? <FourThreeTwo /> : tab === 'shadow' ? <Shadowing /> : <Phrases />}</div>
      </div>
    </>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div class="card center" style={{ padding: 10 }}><div class="big-num num" style={{ fontSize: 22, color: good === undefined ? undefined : good ? 'var(--good)' : 'var(--warn)' }}>{value}</div><div class="tiny muted">{label}</div></div>;
}

/** 4/3/2 technique: tell the same talk three times with less time. Repetition frees attention for speed. */
function FourThreeTwo() {
  const [lengths, setLengths] = useState<'std' | 'short'>('short');
  const [topic, setTopic] = useState(pick(THINKING_TOPICS));
  const [round, setRound] = useState(-1);
  const [results, setResults] = useState<SpeechMetrics[]>([]);
  const secs = lengths === 'std' ? [120, 90, 60] : [60, 45, 30];

  async function onRound(r: CaptureResult) {
    const m = computeMetrics(r.transcript);
    const all = [...results, m];
    setResults(all);
    await addPracticeSeconds(r.durationSec, m.speakingSec);
    if (round < 2) { setRound(round + 1); return; }
    setRound(3);
    const f = fluencyScore(m);
    await saveSession({ type: 'fluency', mode: '4-3-2', title: `4-3-2: ${topic}`, startedAt: Date.now() - 300000, endedAt: Date.now(), durationSec: secs.reduce((a, b) => a + b, 0), speakingSec: all.reduce((a, x) => a + x.speakingSec, 0), scores: { overall: f.score, fluency: f.score }, metrics: m, mistakeCount: 0, report: { rounds: all.map((x) => ({ wpm: x.articulationWpm || x.wpm, longPauses: x.longPauses, fillers: x.fillers })) } });
    await markActiveToday();
  }

  if (round === -1) {
    return (
      <div>
        <div class="card soft small">You tell the <b>same</b> talk three times with less time each round ({secs.join(' → ')} seconds). Because you already know what to say, your brain focuses on speed and flow – this is a proven way to cut pauses and speak faster.</div>
        <div class="card mt">
          <div class="label">Topic</div>
          <div style={{ fontSize: 18, fontWeight: 650, marginTop: 4 }}>{topic}</div>
          <div class="mt"><Segmented value={lengths} onChange={setLengths} options={[{ value: 'short', label: '60 / 45 / 30 s' }, { value: 'std', label: '2 / 1.5 / 1 min' }]} /></div>
          <div class="row mt"><button class="btn ghost" onClick={() => setTopic(pick(THINKING_TOPICS))}><Icon name="refresh" size={18} /> Another</button><button class="btn grow" onClick={() => setRound(0)}>Start round 1</button></div>
        </div>
      </div>
    );
  }
  if (round <= 2) {
    return (
      <div>
        <div class="row between small muted"><span>Round {round + 1} of 3 · {secs[round]} seconds</span><span>Same topic, less time</span></div>
        <div class="card mt mb"><b>{topic}</b>{round > 0 && <div class="small muted mt">Say the SAME things again, just faster and without stopping.</div>}</div>
        {results.length > 0 && <div class="small muted mb">Last round: {Math.round(results[results.length - 1].articulationWpm || results[results.length - 1].wpm)} words/min · {results[results.length - 1].longPauses ?? '–'} long pauses</div>}
        <SpeakCapture key={'r' + round} onSubmit={onRound} maxSec={secs[round]} countdown review={false} allowTyping={false} />
      </div>
    );
  }
  const first = results[0], last = results[results.length - 1];
  const w = (m: SpeechMetrics) => Math.round(m.articulationWpm || m.wpm);
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Your progress across rounds</h2>
      <div class="card">
        {results.map((m, i) => <div class="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><span>Round {i + 1} ({secs[i]}s)</span><span class="num">{w(m)} wpm · {m.longPauses ?? '–'} long pauses · {m.fillers} fillers</span></div>)}
      </div>
      <div class="grid3 mt">
        <Stat label="speed change" value={`${w(last) - w(first) >= 0 ? '+' : ''}${w(last) - w(first)}`} good={w(last) >= w(first)} />
        <Stat label="long pauses (last)" value={String(last.longPauses ?? '–')} good={(last.longPauses ?? 9) <= (first.longPauses ?? 9)} />
        <Stat label="fillers (last)" value={String(last.fillers)} good={last.fillers <= first.fillers} />
      </div>
      <div class="notice info small mt">Goal: each round a bit faster with fewer long pauses. Natural conversation speed is about 120–160 words per minute.</div>
      <button class="btn block mt2" onClick={() => { setResults([]); setTopic(pick(THINKING_TOPICS)); setRound(-1); }}>New topic</button>
    </div>
  );
}

/** Shadowing: listen to a natural sentence, then say it at the same speed and rhythm. */
function Shadowing() {
  const [i, setI] = useState(Math.floor(Math.random() * SHADOWING_TEXTS.length));
  const [res, setRes] = useState<{ acc: number; wpm: number; pauses: number; diff: ReturnType<typeof alignWords> } | null>(null);
  const text = SHADOWING_TEXTS[i];
  async function onSaid(r: CaptureResult) {
    const m = computeMetrics(r.transcript);
    const diff = alignWords(tokenize(text), tokenize(r.transcript.text));
    const acc = diff.filter((d) => d.status === 'ok').length / Math.max(1, diff.length);
    setRes({ acc, wpm: Math.round(m.articulationWpm || m.wpm), pauses: m.longPauses ?? 0, diff });
    await addPracticeSeconds(r.durationSec, m.speakingSec);
    await markActiveToday();
  }
  return (
    <div>
      <div class="card soft small">1. Listen. 2. Listen again and whisper along. 3. Record yourself saying it at the <b>same speed</b>, linking words together without stopping.</div>
      <div class="card mt">
        <div style={{ fontSize: 17, lineHeight: 1.6 }}>{text}</div>
        <div class="row mt">
          <button class="btn sm" onClick={() => speak(text, { rate: 1 })}><Icon name="volume" size={16} /> Natural speed</button>
          <button class="btn sm ghost" onClick={() => speak(text, { rate: 0.8 })}>Slower</button>
        </div>
      </div>
      {!res ? (
        <div class="mt"><SpeakCapture key={'s' + i} onSubmit={onSaid} maxSec={45} review={false} allowTyping={false} /></div>
      ) : (
        <div class="card mt">
          <div class="grid3">
            <Stat label="words matched" value={`${Math.round(res.acc * 100)}%`} good={res.acc >= 0.85} />
            <Stat label="words/min" value={String(res.wpm)} good={res.wpm >= 120} />
            <Stat label="long pauses" value={String(res.pauses)} good={res.pauses === 0} />
          </div>
          <div class="word-diff mt" style={{ lineHeight: 1.7 }}>{res.diff.map((d) => <span class={d.status}>{d.word} </span>)}</div>
          <div class="tiny muted mt">Aim for 0 long pauses and 130+ words/min. Red = said differently, struck = missed.</div>
          <div class="row mt"><button class="btn ghost grow" onClick={() => setRes(null)}>Again</button><button class="btn grow" onClick={() => { setRes(null); setI((i + 1) % SHADOWING_TEXTS.length); }}>Next</button></div>
        </div>
      )}
    </div>
  );
}

/** Ready-made phrases to fill thinking time instead of silence or "umm". */
function Phrases() {
  const [task, setTask] = useState<{ q: string; must: string[] } | null>(null);
  const [res, setRes] = useState<{ used: string[]; missed: string[]; pauses: number } | null>(null);
  function newTask() {
    const groups = [...THINKING_PHRASES].sort(() => Math.random() - 0.5).slice(0, 2);
    setTask({ q: pick(INSTANT_QUESTIONS), must: groups.map((g) => pick(g.phrases)) });
    setRes(null);
  }
  async function onSaid(r: CaptureResult) {
    if (!task) return;
    const said = normalize(r.transcript.text);
    const key = (p: string) => normalize(p.replace(/…/g, '')).split(' ').filter((w) => w.length > 1).slice(0, 3).join(' ');
    const used = task.must.filter((p) => said.includes(key(p)));
    const m = computeMetrics(r.transcript);
    setRes({ used, missed: task.must.filter((p) => !used.includes(p)), pauses: m.longPauses ?? 0 });
    await addPracticeSeconds(r.durationSec, m.speakingSec);
  }
  return (
    <div>
      <div class="card soft small">Fluent speakers rarely go silent – they use short “thinking phrases” while they plan the next sentence. Learn these, then use them instead of “umm” or long gaps.</div>
      <div class="card mt">
        {!task ? <button class="btn block" onClick={newTask}>Practise: answer using 2 phrases</button> : (
          <>
            <div class="label">Answer this</div>
            <b>{task.q}</b>
            <div class="small mt">Use: {task.must.map((p) => <span class="badge accent" style={{ marginRight: 6 }}>{p}</span>)}</div>
            {!res ? <div class="mt"><SpeakCapture key={task.q} onSubmit={onSaid} maxSec={45} review={false} /></div> : (
              <div class={`notice mt small ${res.missed.length ? '' : 'good'}`}>
                {res.missed.length ? <>Used {res.used.length}/2. Try again with: <b>{res.missed.join(', ')}</b></> : '✓ You used both phrases!'} · Long pauses: {res.pauses}
                <div class="row mt"><button class="btn sm" onClick={newTask}>Next question</button></div>
              </div>
            )}
          </>
        )}
      </div>
      {THINKING_PHRASES.map((g) => (
        <div class="card mt">
          <div class="label">{g.group}</div>
          {g.phrases.map((p) => <div class="list-item" onClick={() => speak(p)}><span class="grow">{p}</span><Icon name="volume" size={16} /></div>)}
        </div>
      ))}
    </div>
  );
}
