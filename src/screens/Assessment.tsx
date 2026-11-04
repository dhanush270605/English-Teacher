import { useEffect, useState } from 'preact/hooks';
import { Top, Loading, ErrorBox, Bar, ScoreRing } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { ASSESS_GRAMMAR, ASSESS_SPEAKING, PSEUDO_WORDS, VOCAB_TEST } from '../data/content/assessment';
import { estimateCefr, levelToDifficulty, type AssessmentParts } from '../engine/cefr';
import { db, getKV, setKV, saveProfile, useLive } from '../services/db';
import { analyzeSpeech, completeTask, saveSession } from '../services/learning';
import { chatJson, friendlyError } from '../services/ai/router';
import { listeningSystem } from '../services/ai/prompts';
import { speak } from '../services/speech/tts';
import { go } from '../router';

type Part = 'menu' | 'grammar' | 'vocab' | 'speak0' | 'speak1' | 'listening' | 'result';

export function Assessment() {
  const [parts, setParts] = useState<AssessmentParts & { speakingDone?: string[] }>({});
  const [part, setPart] = useState<Part>('menu');
  const [result, setResult] = useState<ReturnType<typeof estimateCefr> | null>(null);
  const history = useLive(() => db.assessments.orderBy('ts').reverse().limit(6).toArray(), []);
  useEffect(() => { getKV('assessmentDraft', {}).then((d: any) => setParts(d)); }, []);
  async function update(p: Partial<typeof parts>) { const n = { ...parts, ...p }; setParts(n); await setKV('assessmentDraft', n); setPart('menu'); }
  const doneCount = [parts.grammarQuiz, parts.vocabTest, parts.speaking?.length, typeof parts.listening === 'number'].filter(Boolean).length;

  async function finish() {
    const est = estimateCefr(parts);
    setResult(est);
    if (est.level) {
      await db.assessments.add({ ts: Date.now(), parts, level: est.level, composite: est.composite, breakdown: est.breakdown });
      await saveProfile({ level: est.level, levelSource: 'assessment', difficulty: levelToDifficulty(est.level) });
      await saveSession({ type: 'assessment', title: `Assessment ≈ ${est.level}`, startedAt: Date.now() - 900000, endedAt: Date.now(), durationSec: 900, speakingSec: 0, scores: { overall: est.composite }, mistakeCount: 0, report: est });
      await completeTask('assessment', est.composite);
      await setKV('assessmentDraft', {});
    }
    setPart('result');
  }

  const items: { id: Part; title: string; done: boolean; text: string }[] = [
    { id: 'grammar', title: 'Grammar quiz', done: !!parts.grammarQuiz, text: '15 questions, A1→C1' },
    { id: 'vocab', title: 'Vocabulary check', done: !!parts.vocabTest, text: 'Tick the words you know' },
    { id: 'speak0', title: ASSESS_SPEAKING[0].title, done: !!parts.speakingDone?.includes('intro'), text: '60 seconds speaking' },
    { id: 'speak1', title: ASSESS_SPEAKING[1].title, done: !!parts.speakingDone?.includes('opinion'), text: '90 seconds speaking' },
    { id: 'listening', title: 'Listening', done: typeof parts.listening === 'number', text: 'Dialogue + 4 questions' },
  ];

  return (
    <>
      <Top title="Level assessment" backTo={part === 'menu' || part === 'result' ? true : undefined} right={part !== 'menu' && part !== 'result' ? <button class="icon-btn" aria-label="Close" onClick={() => setPart('menu')}><Icon name="x" /></button> : undefined} />
      <div class="screen no-nav" style={{ paddingTop: 4 }}>
        {part === 'menu' && (
          <>
            <p class="small muted" style={{ marginTop: 0 }}>Complete at least 3 parts (all 5 for the best estimate). The result is an <b>informal CEFR estimate</b>, not an official certificate. Progress is saved if you stop.</p>
            <div class="card">{items.map((it) => (
              <div class="list-item" onClick={() => setPart(it.id)}>
                <div class="task" style={{ padding: 0, border: 'none', background: 'none' }}><div class="ico" style={it.done ? { background: 'var(--good-soft)', color: 'var(--good)' } : undefined}><Icon name={it.done ? 'check' : 'target'} size={18} /></div></div>
                <div class="grow"><b>{it.title}</b><div class="tiny muted">{it.text}</div></div>
                <Icon name="chevron" size={18} />
              </div>
            ))}</div>
            <button class="btn block mt2" disabled={doneCount < 3} onClick={finish}>Get my level estimate ({doneCount}/5 done)</button>
            {history && history.length > 0 && (
              <>
                <h2>Previous assessments</h2>
                <div class="card">{history.map((h) => <div class="row between small" style={{ padding: '6px 0' }}><span>{new Date(h.ts).toLocaleDateString()}</span><span><b>{h.level}</b> <span class="muted num">({h.composite})</span></span></div>)}</div>
              </>
            )}
          </>
        )}
        {part === 'grammar' && <GrammarQuiz onDone={(byLevel) => update({ grammarQuiz: { byLevel } })} />}
        {part === 'vocab' && <VocabTest onDone={(v) => update({ vocabTest: v })} />}
        {(part === 'speak0' || part === 'speak1') && (
          <SpeakingPart idx={part === 'speak0' ? 0 : 1} onDone={(score) => update({ speaking: [...(parts.speaking || []), score], speakingDone: [...(parts.speakingDone || []), ASSESS_SPEAKING[part === 'speak0' ? 0 : 1].id] })} />
        )}
        {part === 'listening' && <ListeningPart onDone={(pct) => update({ listening: pct })} />}
        {part === 'result' && result && (
          <div class="center">
            <div class="card">
              {result.level ? (
                <>
                  <div class="label">Estimated level</div>
                  <div style={{ fontSize: 54, fontWeight: 800, color: 'var(--accent)' }}>{result.level}</div>
                  <ScoreRing value={result.composite} label="composite" />
                </>
              ) : <div>{result.note}</div>}
              <div style={{ textAlign: 'left' }} class="mt">
                {Object.entries(result.breakdown).map(([k, v]) => <div style={{ marginTop: 8 }}><div class="row between small"><span style={{ textTransform: 'capitalize' }}>{k}</span><b class="num">{v}</b></div><Bar value={v} /></div>)}
              </div>
              <p class="tiny muted mt">{result.note}</p>
            </div>
            <button class="btn block mt" onClick={() => go('#/home')}>Back to home</button>
          </div>
        )}
      </div>
    </>
  );
}

function GrammarQuiz({ onDone }: { onDone: (b: Record<string, { correct: number; total: number }>) => void }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<number[]>([]);
  const q = ASSESS_GRAMMAR[i];
  function pick(k: number) {
    const a = [...ans, k];
    setAns(a);
    if (i + 1 < ASSESS_GRAMMAR.length) setI(i + 1);
    else {
      const by: Record<string, { correct: number; total: number }> = {};
      ASSESS_GRAMMAR.forEach((g, j) => { by[g.level] = by[g.level] || { correct: 0, total: 0 }; by[g.level].total++; if (a[j] === g.answer) by[g.level].correct++; });
      onDone(by);
    }
  }
  return (
    <div>
      <div class="small muted">Question {i + 1} of {ASSESS_GRAMMAR.length}</div>
      <Bar value={(i / ASSESS_GRAMMAR.length) * 100} />
      <div class="card mt"><b>{q.q}</b></div>
      {q.options.map((o, k) => <button class="opt" onClick={() => pick(k)}>{o}</button>)}
      <p class="tiny muted mt">No feedback during the test – answer honestly; guessing makes the estimate less accurate.</p>
    </div>
  );
}

function VocabTest({ onDone }: { onDone: (v: NonNullable<AssessmentParts['vocabTest']>) => void }) {
  const [items] = useState(() => [...VOCAB_TEST.flatMap((l) => l.words.map((w) => ({ w, level: l.level }))), ...PSEUDO_WORDS.map((w) => ({ w, level: 'pseudo' }))].sort(() => Math.random() - 0.5));
  const [known, setKnown] = useState<Set<string>>(new Set());
  function submit() {
    const byLevel: Record<string, { yes: number; total: number }> = {};
    let fa = 0;
    for (const it of items) {
      if (it.level === 'pseudo') { if (known.has(it.w)) fa++; continue; }
      byLevel[it.level] = byLevel[it.level] || { yes: 0, total: 0 };
      byLevel[it.level].total++;
      if (known.has(it.w)) byLevel[it.level].yes++;
    }
    onDone({ byLevel, falseAlarms: fa, pseudoTotal: PSEUDO_WORDS.length });
  }
  return (
    <div>
      <p class="small">Tick every word whose meaning you know. Some words are <b>not real</b> – ticking them lowers your score.</p>
      <div class="grid2">{items.map((it) => (
        <button class={`opt ${known.has(it.w) ? 'right' : ''}`} style={{ marginTop: 0 }} onClick={() => { const n = new Set(known); n.has(it.w) ? n.delete(it.w) : n.add(it.w); setKnown(n); }}>{known.has(it.w) ? '✓ ' : ''}{it.w}</button>
      ))}</div>
      <button class="btn block mt2" onClick={submit}>Done ({known.size} ticked)</button>
    </div>
  );
}

function SpeakingPart({ idx, onDone }: { idx: number; onDone: (score: number) => void }) {
  const item = ASSESS_SPEAKING[idx];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function onSpoken(r: CaptureResult) {
    setBusy(true); setErr('');
    const res = await analyzeSpeech(item.prompt, [r.transcript]);
    if (res.aiError) setErr('Note: ' + res.aiError + ' Your score uses speech measurements only.');
    await saveSession({ type: 'assessment', title: `Assessment: ${item.title}`, startedAt: Date.now() - r.durationSec * 1000, endedAt: Date.now(), durationSec: r.durationSec, speakingSec: res.metrics?.speakingSec || r.durationSec, scores: res.scores, metrics: res.metrics, mistakeCount: res.corrections.length }, res.corrections);
    setBusy(false);
    onDone(res.scores?.overall || 0);
  }
  return (
    <div>
      <div class="card"><div class="label">{item.title}</div><div class="mt">{item.prompt}</div></div>
      {err && <div class="notice small mt">{err}</div>}
      {busy ? <Loading text="Scoring…" /> : <div class="mt"><SpeakCapture onSubmit={onSpoken} maxSec={item.seconds} countdown /></div>}
    </div>
  );
}

function ListeningPart({ onDone }: { onDone: (pct: number) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [ans, setAns] = useState<(number | null)[]>([]);
  async function load() {
    setErr('');
    try {
      const r = await chatJson<any>({ purpose: 'assessment-listening', system: listeningSystem('B1', 'en-US'), messages: [{ role: 'user', content: 'Theme: making weekend plans with a friend' }], tier: 'fast', maxTokens: 1100 });
      r.questions = (r.questions || []).filter((q: any) => q.answer >= 0 && q.answer < (q.options || []).length).slice(0, 4);
      if (!r.questions.length) throw new Error('Could not create the listening test.');
      setD(r); setAns(Array(r.questions.length).fill(null));
    } catch (e) { setErr(friendlyError(e)); }
  }
  useEffect(() => { load(); }, []);
  if (err) return <ErrorBox error={err} onRetry={load} />;
  if (!d) return <Loading text="Preparing dialogue…" />;
  return (
    <div>
      <button class="btn block" onClick={async () => { for (const l of d.lines) await speak(l.text, { pitch: l.speaker === 'B' ? 1.25 : 0.9 }); }}><Icon name="play" size={18} /> Play dialogue (listen up to twice)</button>
      {d.questions.map((q: any, i: number) => (
        <div class="card mt"><b>{q.q}</b>{q.options.map((o: string, k: number) => <button class={`opt ${ans[i] === k ? 'right' : ''}`} onClick={() => { const a = [...ans]; a[i] = k; setAns(a); }}>{o}</button>)}</div>
      ))}
      <button class="btn block mt2" disabled={ans.some((a) => a === null)} onClick={() => onDone(Math.round((ans.filter((a, i) => a === d.questions[i].answer).length / d.questions.length) * 100))}>Submit</button>
    </div>
  );
}
