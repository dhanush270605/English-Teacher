import { useEffect, useRef, useState } from 'preact/hooks';
import type { Correction, Transcript } from '../types';
import { Top, Loading, ErrorBox, Segmented, fmtTime, Bar } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { INTERVIEW_KINDS } from '../data/content/practice';
import { chatJson, friendlyError } from '../services/ai/router';
import { interviewerSystem, interviewReportSystem } from '../services/ai/prompts';
import { completeTask, learnerCtx, previousScores, saveSession } from '../services/learning';
import { recentKeys, markUsed } from '../services/db';
import { verifyCorrections, scoreSession, compareToPrevious } from '../engine/scoring';
import { sessionMetrics } from '../engine/metrics';
import { speak, stopSpeaking } from '../services/speech/tts';
import { ScoreGrid, CorrectionCard, MetricsPanel } from '../ui/Report';
import { go } from '../router';

type Level = 'beginner' | 'intermediate' | 'advanced';
interface Eval { grammar: number; clarity: number; relevance: number; structure: number; completeness: number; professional: number; star?: { situation: boolean; task: boolean; action: boolean; result: boolean }; feedback: string; improvedAnswer: string }
interface QA { q: string; answer: string; transcript: Transcript; evaluation?: Eval; corrections: Correction[] }

const DIMS: (keyof Eval)[] = ['grammar', 'clarity', 'relevance', 'structure', 'completeness', 'professional'];

export function Interview() {
  const [kind, setKind] = useState('hr');
  const [level, setLevel] = useState<Level>('intermediate');
  const [role, setRole] = useState('');
  const [count, setCount] = useState(5);
  const [answerSec, setAnswerSec] = useState(90);
  const [phase, setPhase] = useState<'setup' | 'running' | 'report'>('setup');
  const [qas, setQas] = useState<QA[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [speaking, setSpeaking] = useState(false);
  const bank = useRef<string[]>([]);
  const startedAt = useRef(0);
  const lastAnswer = useRef<CaptureResult | null>(null);

  const k = INTERVIEW_KINDS.find((x) => x.id === kind)!;

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => () => { stopSpeaking(); }, []);

  async function ask(q: string) {
    setQuestion(q);
    setSpeaking(true);
    try { await speak(q); } finally { setSpeaking(false); }
  }

  async function start() {
    const recent = await recentKeys(14);
    const qs = [...k.questions[level]].sort(() => Math.random() - 0.5);
    bank.current = [...qs.filter((q) => !recent.has('iq:' + q)), ...qs.filter((q) => recent.has('iq:' + q))];
    setQas([]); setReport(null); setError('');
    startedAt.current = Date.now();
    setPhase('running');
    ask(bank.current.shift()!);
  }

  async function onAnswer(r: CaptureResult) {
    lastAnswer.current = r;
    await evaluate(r);
  }

  async function evaluate(r: CaptureResult) {
    setBusy('Interviewer is evaluating…'); setError('');
    try {
      const ctx = await learnerCtx();
      const nextBank = bank.current[0] || '';
      const prior = qas.slice(-2).map((x) => `Q: ${x.q}\nA: ${x.answer}`).join('\n');
      const res = await chatJson<{ evaluation: Eval; corrections: Correction[]; nextQuestion: string }>({
        purpose: 'interview', tier: 'smart', maxTokens: 900, temperature: 0.3,
        system: interviewerSystem(k.label, level, role) + '\n' + ctx,
        messages: [{ role: 'user', content: `${prior ? 'Earlier:\n' + prior + '\n' : ''}Question: ${question}\nCandidate answer (speech transcript): ${r.transcript.text}\nSuggested next question from the bank: ${nextBank || '(none – ask a relevant new one)'}. Ask it, or a short follow-up if the answer was vague.` }],
      });
      await markUsed('iq:' + question);
      const qa: QA = { q: question, answer: r.transcript.text, transcript: r.transcript, evaluation: res.evaluation, corrections: verifyCorrections(r.transcript.text, res.corrections || []) };
      const all = [...qas, qa];
      setQas(all);
      setBusy('');
      if (all.length >= count) { await finish(all); return; }
      const next = (res.nextQuestion || '').trim() || bank.current[0] || 'Do you have any questions for us?';
      if (bank.current[0] && next.toLowerCase().includes(bank.current[0].toLowerCase().slice(0, 25))) bank.current.shift();
      else if (!res.nextQuestion && bank.current.length) bank.current.shift();
      ask(next);
    } catch (e) {
      setBusy('');
      setError(friendlyError(e));
    }
  }

  async function finish(all: QA[]) {
    setBusy('Preparing your interview report…');
    const transcripts = all.map((x) => x.transcript);
    const metrics = sessionMetrics(transcripts)!;
    const corrections = all.flatMap((x) => x.corrections);
    const rubric = (d: keyof Eval) => { const v = all.map((x) => x.evaluation?.[d] as number).filter((n) => typeof n === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined; };
    const r = scoreSession({ transcript: all.map((x) => x.answer).join(' '), metrics, corrections, relevance: rubric('relevance') });
    const rubricScores = Object.fromEntries(DIMS.map((d) => [d, rubric(d) !== undefined ? Math.round(rubric(d)! * 25) : undefined]));
    let ai: any = {};
    try {
      ai = await chatJson({ purpose: 'interview-report', tier: 'fast', maxTokens: 500, system: interviewReportSystem, messages: [{ role: 'user', content: JSON.stringify(all.map((x) => ({ q: x.q, eval: x.evaluation, mistakes: x.corrections.map((c) => c.category) }))) }] });
    } catch { /* report still works without narrative */ }
    const delta = compareToPrevious(r.scores, await previousScores('interview'));
    const durationSec = (Date.now() - startedAt.current) / 1000;
    await saveSession({ type: 'interview', mode: kind, title: `${k.label} (${level})`, startedAt: startedAt.current, endedAt: Date.now(), durationSec, speakingSec: metrics.speakingSec, scores: r.scores, metrics, mistakeCount: r.verified.length, report: { qas: all.map(({ transcript, ...x }) => x), rubricScores, ai } }, r.verified);
    await completeTask('interview', r.scores.overall);
    setReport({ ...r, metrics, rubricScores, ai, delta, all });
    setBusy('');
    setPhase('report');
  }

  if (phase === 'setup') {
    return (
      <>
        <Top title="Interview trainer" backTo={true} />
        <div class="screen no-nav" style={{ paddingTop: 4 }}>
          <div class="label mb">Interview type</div>
          <div class="chips" style={{ flexWrap: 'wrap' }}>{INTERVIEW_KINDS.map((x) => <button class={`chip ${kind === x.id ? 'on' : ''}`} onClick={() => setKind(x.id)}>{x.label}</button>)}</div>
          <div class="label mt mb">Level</div>
          <Segmented value={level} onChange={setLevel} options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} />
          <label class="field mt"><span>Target role (optional)</span><input class="input" maxLength={80} placeholder="e.g. Software developer intern" value={role} onInput={(e) => setRole((e.target as HTMLInputElement).value)} /></label>
          <div class="label mb">Questions</div>
          <Segmented value={count} onChange={setCount} options={[{ value: 3, label: '3' }, { value: 5, label: '5' }, { value: 8, label: '8' }]} />
          <div class="label mt mb">Time per answer</div>
          <Segmented value={answerSec} onChange={setAnswerSec} options={[{ value: 60, label: '1 min' }, { value: 90, label: '1.5 min' }, { value: 120, label: '2 min' }]} />
          {k.behavioural && (
            <div class="card soft mt small">
              <b>STAR method</b> – <b>S</b>ituation (where/when), <b>T</b>ask (your responsibility), <b>A</b>ction (what YOU did, step by step), <b>R</b>esult (outcome, numbers, what you learned).
            </div>
          )}
          <button class="btn block mt2" onClick={start}><Icon name="briefcase" size={18} /> Start mock interview</button>
        </div>
      </>
    );
  }

  if (phase === 'report' && report) {
    return (
      <>
        <Top title="Interview report" backTo="#/practice" />
        <div class="screen no-nav">
          <ScoreGrid scores={report.scores} delta={report.delta} fluencyPartial={report.fluencyPartial} />
          <div class="card mt">
            <h3>Interview rubric (AI, 0–100)</h3>
            {DIMS.map((d) => typeof report.rubricScores[d] === 'number' && (
              <div style={{ marginTop: 8 }}><div class="row between small"><span style={{ textTransform: 'capitalize' }}>{d}</span><b class="num">{report.rubricScores[d]}</b></div><Bar value={report.rubricScores[d]} /></div>
            ))}
          </div>
          {report.ai?.weaknesses?.length > 0 && <><h2>Weaknesses</h2><div class="card small">{report.ai.weaknesses.map((w: string) => <div>• {w}</div>)}</div></>}
          {report.ai?.strengths?.length > 0 && <><h2>Strengths</h2><div class="card small">{report.ai.strengths.map((w: string) => <div>• {w}</div>)}</div></>}
          <h2>Your answers</h2>
          {report.all.map((x: QA, i: number) => (
            <div class="card mb">
              <div class="label">Question {i + 1}</div>
              <b>{x.q}</b>
              <div class="small muted mt">You said: {x.answer}</div>
              {x.evaluation?.feedback && <div class="small mt">{x.evaluation.feedback}</div>}
              {x.evaluation?.star && Object.values(x.evaluation.star).some(Boolean) && (
                <div class="row wrap mt">{(['situation', 'task', 'action', 'result'] as const).map((s) => <span class={`badge ${x.evaluation!.star![s] ? 'good' : 'bad'}`}>{x.evaluation!.star![s] ? '✓' : '✗'} {s}</span>)}</div>
              )}
              {x.evaluation?.improvedAnswer && (
                <div class="card soft mt small"><div class="label">Improved answer (same meaning)</div>{x.evaluation.improvedAnswer}<div><button class="btn sm ghost mt" onClick={() => speak(x.evaluation!.improvedAnswer)}><Icon name="volume" size={16} /> Listen</button></div></div>
              )}
              {x.corrections.map((c) => <div class="mt"><CorrectionCard c={c} /></div>)}
            </div>
          ))}
          {report.ai?.exercises?.length > 0 && <><h2>Improvement exercises</h2><div class="card small">{report.ai.exercises.map((w: string) => <div>• {w}</div>)}</div></>}
          {report.ai?.nextInterview && <div class="notice info mt small"><b>Recommended next:</b> {report.ai.nextInterview}</div>}
          <h2>Speaking measurements</h2>
          <MetricsPanel m={report.metrics} />
          <div class="row mt2"><button class="btn ghost grow" onClick={() => go('#/home')}>Home</button><button class="btn grow" onClick={() => setPhase('setup')}>New interview</button></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Top title={k.label} backTo={true} right={<span class="badge num">{fmtTime(elapsed)}</span>} />
      <div class="screen no-nav" style={{ paddingTop: 4 }}>
        <div class="row between small muted"><span>Question {Math.min(qas.length + 1, count)} of {count}</span><span>{level}</span></div>
        <Bar value={(qas.length / count) * 100} />
        <div class="card mt" style={{ minHeight: 110 }}>
          <div class="label">Interviewer</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>{question || '…'}</div>
          <button class="btn sm ghost mt" onClick={() => ask(question)}><Icon name="volume" size={16} /> Repeat question</button>
        </div>
        {qas.length > 0 && qas[qas.length - 1].evaluation?.feedback && (
          <div class="card soft mt small"><div class="label">Feedback on last answer</div>{qas[qas.length - 1].evaluation!.feedback}</div>
        )}
        {error && <div class="mt"><ErrorBox error={error} onRetry={() => lastAnswer.current && evaluate(lastAnswer.current)} /></div>}
        {busy ? <Loading text={busy} /> : (
          <div class="dock">
            <SpeakCapture key={question} onSubmit={onAnswer} maxSec={answerSec} countdown speaking={speaking} hint="Tap the mic to answer" />
            {qas.length > 0 && <div class="center mt"><button class="btn sm ghost" onClick={() => finish(qas)}>End interview now</button></div>}
          </div>
        )}
      </div>
    </>
  );
}
