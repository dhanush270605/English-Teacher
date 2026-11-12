import { useEffect, useRef, useState } from 'preact/hooks';
import type { Transcript } from '../types';
import { Top, Loading, Segmented } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { INSTANT_QUESTIONS, STORY_STARTERS, THINKING_TOPICS } from '../data/content/practice';
import { analyzeSpeech, completeTask, previousScores, saveSession, type AnalysisResult } from '../services/learning';
import { db, markUsed, recentKeys } from '../services/db';
import { compareToPrevious } from '../engine/scoring';
import { ScoreGrid, CorrectionCard, MetricsPanel } from '../ui/Report';
import { speak } from '../services/speech/tts';

type Mode = 'impromptu' | 'instant' | 'story';
type Phase = 'setup' | 'prep' | 'speak' | 'analyzing' | 'report';

async function freshTopic(mode: Mode): Promise<string> {
  const pool = mode === 'story' ? STORY_STARTERS : THINKING_TOPICS;
  const recent = await recentKeys(30);
  const fresh = pool.filter((t) => !recent.has('think:' + t));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function Thinking({ topic: initialTopic }: { topic?: string }) {
  const quick = location.hash.includes('quick=1');
  const [mode, setMode] = useState<Mode>(quick ? 'instant' : 'impromptu');
  const [phase, setPhase] = useState<Phase>('setup');
  const [topic, setTopic] = useState(initialTopic || '');
  const [duration, setDuration] = useState(60);
  const [prep, setPrep] = useState(5);
  const [questions, setQuestions] = useState<string[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Transcript[]>([]);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [result, setResult] = useState<(AnalysisResult & { delta?: any }) | null>(null);
  const startedAt = useRef(Date.now());
  const touched = useRef(!!initialTopic);

  useEffect(() => {
    (async () => {
      const n = await db.sessions.where('type').equals('impromptu').count();
      setDuration(Math.min(120, 45 + 15 * Math.floor(n / 2))); // grows as you practise
      if (!touched.current) { const t = await freshTopic('impromptu'); if (!touched.current) setTopic(t); }
      if (quick) startInstant(1);
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'prep') return;
    if (prep <= 0) { setPhase('speak'); return; }
    const t = setTimeout(() => setPrep(prep - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, prep]);

  async function switchMode(m: Mode) {
    touched.current = true;
    setMode(m);
    if (m !== 'instant') setTopic(await freshTopic(m));
  }
  async function another() { touched.current = true; setTopic(await freshTopic(mode)); }

  function startTalk() {
    touched.current = true;
    startedAt.current = Date.now();
    setAnswers([]); setLatencies([]); setResult(null);
    setPrep(5); setPhase('prep');
    speak(topic);
  }

  function startInstant(n = 5) {
    startedAt.current = Date.now();
    const qs = [...INSTANT_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, n);
    setQuestions(qs); setQIndex(0); setAnswers([]); setLatencies([]); setResult(null);
    setPhase('speak');
    speak(qs[0]);
  }

  async function onTalk(r: CaptureResult) {
    setPhase('analyzing');
    const task = mode === 'story' ? `Continue/tell this story without preparing: ${topic}` : `Speak without preparation about: ${topic}`;
    await finalize([r.transcript], task, r.durationSec, topic);
  }

  async function onInstant(r: CaptureResult) {
    const all = [...answers, r.transcript];
    setAnswers(all);
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
      speak(questions[qIndex + 1]);
    } else {
      setPhase('analyzing');
      await finalize(all, 'Answer quick everyday questions instantly: ' + questions.join(' | '), all.reduce((a, t) => a + t.durationSec, 0));
    }
  }

  async function finalize(ts: Transcript[], task: string, dur: number, usedTopic?: string) {
    const res = await analyzeSpeech(task, ts);
    const delta = compareToPrevious(res.scores!, await previousScores('impromptu'));
    await saveSession({ type: 'impromptu', mode, title: mode === 'instant' ? 'Instant responses' : usedTopic, startedAt: startedAt.current, endedAt: Date.now(), durationSec: dur, speakingSec: res.metrics?.speakingSec || dur, scores: res.scores, metrics: res.metrics, mistakeCount: res.corrections.length, report: { topic: usedTopic, latencies, questions, transcript: ts.map((t) => t.text).join(' ') } }, res.corrections);
    if (usedTopic) await markUsed('think:' + usedTopic);
    await completeTask('thinking', res.scores?.overall);
    setResult({ ...res, delta });
    setPhase('report');
  }

  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

  return (
    <>
      <Top title={quick ? 'Quick practice' : 'Think in English'} backTo={true} />
      <div class="screen no-nav" style={{ paddingTop: 4 }}>
        {phase === 'setup' && !quick && (
          <>
            <Segmented value={mode} onChange={switchMode} options={[{ value: 'impromptu', label: 'Impromptu talk' }, { value: 'instant', label: 'Instant answers' }, { value: 'story', label: 'Story' }]} />
            {mode !== 'instant' ? (
              <div class="card mt">
                <div class="label">{mode === 'story' ? 'Continue this story' : 'Your topic'}</div>
                <div style={{ fontSize: 19, fontWeight: 650, marginTop: 6 }}>{topic || '…'}</div>
                <div class="small muted mt">5 seconds to think, then speak for {duration} seconds. Don’t translate – start with a simple sentence and keep going. Short silent pauses are fine; long “umm”s are what we train away.</div>
                <div class="row mt">
                  <button class="btn ghost" onClick={another}><Icon name="refresh" size={18} /> Another</button>
                  <button class="btn grow" disabled={!topic} onClick={startTalk}>Start</button>
                </div>
              </div>
            ) : (
              <div class="card mt">
                <div class="small">Five quick everyday questions. Answer each one immediately in 1–3 sentences. We measure how quickly you start speaking and how many fillers you use.</div>
                <button class="btn block mt" onClick={() => startInstant(5)}>Start</button>
              </div>
            )}
            <div class="card soft mt small">
              <b>Avoid excessive fillers:</b> “umm”, “actually”, “basically”, “like”, “you know”. When you need time, use a thinking phrase instead: “Let me think…”, “The thing is…”, “What I mean is…”.
            </div>
          </>
        )}
        {phase === 'prep' && (
          <div class="card center mt">
            <div style={{ fontSize: 18, fontWeight: 650 }}>{topic}</div>
            <div class="big-num num mt">{prep}</div>
            <div class="small muted">Think in English…</div>
          </div>
        )}
        {phase === 'speak' && mode !== 'instant' && (
          <>
            <div class="card mb"><div class="label">{mode === 'story' ? 'Story' : 'Topic'}</div><b>{topic}</b></div>
            <SpeakCapture key={'talk' + topic} onSubmit={onTalk} maxSec={duration} countdown autoStart />
          </>
        )}
        {phase === 'speak' && mode === 'instant' && questions.length > 0 && (
          <>
            <div class="small muted">Question {qIndex + 1} of {questions.length}</div>
            <div class="card mt mb"><div style={{ fontSize: 19, fontWeight: 650 }}>{questions[qIndex]}</div></div>
            <SpeakCapture key={'q' + qIndex} onSubmit={onInstant} maxSec={quick ? 60 : 30} countdown review={false} onFirstVoice={(l) => setLatencies((x) => [...x, l])} />
          </>
        )}
        {phase === 'analyzing' && <Loading text="Analysing…" />}
        {phase === 'report' && result && (
          <>
            {result.aiError && <div class="notice small mb">{result.aiError}</div>}
            <ScoreGrid scores={result.scores!} delta={result.delta} fluencyPartial={result.fluencyPartial} />
            {avgLatency !== null && <div class="card mt small">Average time to start speaking: <b class="num">{avgLatency.toFixed(1)}s</b> {avgLatency <= 2 ? '– excellent, you’re thinking in English.' : avgLatency <= 4 ? '– good. Aim for under 2 seconds.' : '– try starting with a short phrase like “Well, …” or “Let me see…”.'}</div>}
            <div class="card mt small">Fillers: <b>{result.metrics!.fillers}</b> ({result.metrics!.fillersPer100.toFixed(1)} per 100 words). Target: under 3 per 100 words.</div>
            {result.summary && <div class="card mt">{result.summary}</div>}
            {result.corrections.length > 0 && <><h2>Corrections</h2><div class="stack">{result.corrections.map((c) => <CorrectionCard c={c} />)}</div></>}
            <h2>Measurements</h2>
            <MetricsPanel m={result.metrics!} />
            <button class="btn block mt2" onClick={async () => { setResult(null); setPhase('setup'); if (quick) startInstant(1); else if (mode !== 'instant') setTopic(await freshTopic(mode)); }}>Practise again</button>
          </>
        )}
      </div>
    </>
  );
}
