import { useEffect, useState } from 'preact/hooks';
import { Top, Loading, ErrorBox, Segmented, toast } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { PICTURE_CATEGORIES } from '../data/content/practice';
import { nextPicture, markPictureUsed, pictureForAI, type Picture } from '../services/pictures';
import { analyzeSpeech, completeTask, previousScores, saveSession, type AnalysisResult } from '../services/learning';
import { compareToPrevious } from '../engine/scoring';
import { ScoreGrid, CorrectionCard, MetricsPanel } from '../ui/Report';
import { getProfile, db } from '../services/db';
import { speak } from '../services/speech/tts';

const PROMPTS = {
  easy: 'Describe what you see in this picture: the place, the people and the objects.',
  medium: 'Describe what you see. Explain what the people are doing and what might happen next.',
  hard: 'Describe the picture, explain what people are doing, predict what happens next, and give your opinion about the situation – like telling a short story.',
};

export function PictureChallenge({ category }: { category?: string }) {
  const [cat, setCat] = useState<string>(category ? decodeURIComponent(category) : PICTURE_CATEGORIES[0].label);
  const [seconds, setSeconds] = useState(60);
  const [level, setLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [pic, setPic] = useState<Picture | null>(null);
  const [phase, setPhase] = useState<'setup' | 'loading' | 'prep' | 'speak' | 'analyzing' | 'report'>('setup');
  const [prep, setPrep] = useState(10);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(AnalysisResult & { delta?: any; transcript: string }) | null>(null);

  useEffect(() => { getProfile().then((p) => setLevel(p.difficulty <= 2 ? 'easy' : p.difficulty >= 4 ? 'hard' : 'medium')); }, []);

  useEffect(() => {
    if (phase !== 'prep') return;
    if (prep <= 0) { setPhase('speak'); return; }
    const t = setTimeout(() => setPrep(prep - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, prep]);

  async function load() {
    setError(''); setPhase('loading'); setResult(null);
    try {
      const p = await nextPicture(cat);
      setPic(p);
      setPrep(10);
      setPhase('prep');
    } catch (e: any) { setError(e.message); setPhase('setup'); }
  }

  async function onSpoken(r: CaptureResult) {
    if (!pic) return;
    setPhase('analyzing');
    const started = Date.now() - r.durationSec * 1000;
    const image = await pictureForAI(pic);
    const res = await analyzeSpeech(PROMPTS[level], [r.transcript], { picture: { caption: `${pic.title}. ${pic.caption}`, image } });
    const delta = compareToPrevious(res.scores!, await previousScores('picture'));
    const sid = await saveSession({ type: 'picture', title: `Picture: ${pic.category}`, startedAt: started, endedAt: Date.now(), durationSec: r.durationSec, speakingSec: res.metrics?.speakingSec || r.durationSec, scores: res.scores, metrics: res.metrics, mistakeCount: res.corrections.length, report: { picture: pic, modelAnswer: res.modelAnswer, betterExpressions: res.betterExpressions, transcript: r.transcript.text, summary: res.summary } }, res.corrections);
    const prof = await getProfile();
    if (r.blob && prof.storeRecordings) await db.recordings.add({ sessionId: sid, blob: r.blob, mime: r.blob.type, durationSec: r.durationSec, createdAt: Date.now() });
    await markPictureUsed(pic);
    await completeTask('picture', res.scores?.overall);
    setResult({ ...res, delta, transcript: r.transcript.text });
    setPhase('report');
    if (res.aiError) toast('AI feedback unavailable – showing measured scores only.');
  }

  return (
    <>
      <Top title="Picture challenge" backTo={true} />
      <div class="screen no-nav" style={{ paddingTop: 4 }}>
        {phase === 'setup' && (
          <>
            <div class="label mb">Category</div>
            <div class="chips">{PICTURE_CATEGORIES.map((c) => <button class={`chip ${cat === c.label ? 'on' : ''}`} onClick={() => setCat(c.label)}>{c.label}</button>)}</div>
            <div class="label mt mb">Speaking time</div>
            <Segmented value={seconds} onChange={setSeconds} options={[{ value: 30, label: '30 sec' }, { value: 60, label: '60 sec' }, { value: 120, label: '2 min' }]} />
            <div class="label mt mb">Difficulty</div>
            <Segmented value={level} onChange={setLevel} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
            <div class="card soft mt small">{PROMPTS[level]}</div>
            {error && <div class="mt"><ErrorBox error={error} onRetry={load} /></div>}
            <button class="btn block mt2" onClick={load}><Icon name="image" size={18} /> Show me a picture</button>
            <p class="tiny muted center">Photos come from Wikimedia Commons (free, openly licensed).</p>
          </>
        )}
        {phase === 'loading' && <div><div class="pic skeleton" /><Loading text="Finding a picture…" /></div>}
        {pic && ['prep', 'speak', 'analyzing', 'report'].includes(phase) && (
          <>
            <img class="pic" src={pic.thumb} alt={pic.caption || pic.title} loading="lazy" decoding="async" />
            <div class="tiny muted mt">{pic.credit}{pic.license ? ` · ${pic.license}` : ''} · Wikimedia Commons</div>
          </>
        )}
        {phase === 'prep' && (
          <div class="card mt center">
            <div class="small">{PROMPTS[level]}</div>
            <div class="big-num num mt">{prep}</div>
            <div class="muted small">Look carefully. Recording starts automatically.</div>
            <div class="row mt" style={{ justifyContent: 'center' }}>
              <button class="btn ghost sm" onClick={load}>Different picture</button>
              <button class="btn sm" onClick={() => setPrep(0)}>Start now</button>
            </div>
          </div>
        )}
        {phase === 'speak' && (
          <div class="mt">
            <div class="card soft small mb">{PROMPTS[level]}</div>
            <SpeakCapture onSubmit={onSpoken} maxSec={seconds} countdown autoStart allowTyping />
          </div>
        )}
        {phase === 'analyzing' && <Loading text="Analysing your description…" />}
        {phase === 'report' && result && (
          <div class="mt">
            {result.aiError && <div class="notice mb small">{result.aiError} Grammar scores need AI; speech measurements below are still accurate.</div>}
            <ScoreGrid scores={result.scores!} delta={result.delta} fluencyPartial={result.fluencyPartial} />
            {typeof result.descriptionQuality === 'number' && <div class="card mt small">Description quality (AI rubric): <b>{result.descriptionQuality}/4</b> – people, actions, setting, prediction, opinion.</div>}
            {result.summary && <div class="card mt">{result.summary}</div>}
            <h2>What you said</h2>
            <div class="card small">{result.transcript}</div>
            {result.corrections.length > 0 && <><h2>Corrections</h2><div class="stack">{result.corrections.map((c) => <CorrectionCard c={c} />)}</div></>}
            {result.betterExpressions.length > 0 && (
              <><h2>Better expressions</h2><div class="card">{result.betterExpressions.map((b) => <div class="small" style={{ padding: '6px 0' }}><span class="strike">{b.instead}</span> → <b>{b.try}</b></div>)}</div></>
            )}
            {result.modelAnswer && (
              <><h2>Model answer</h2><div class="card"><div class="small">{result.modelAnswer}</div><button class="btn sm soft mt" onClick={() => speak(result.modelAnswer!)}><Icon name="volume" size={16} /> Listen</button></div></>
            )}
            <h2>Measurements</h2>
            <MetricsPanel m={result.metrics!} />
            <button class="btn block mt2" onClick={load}><Icon name="refresh" size={18} /> New challenge</button>
          </div>
        )}
      </div>
    </>
  );
}
