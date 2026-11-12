import { useEffect, useRef, useState } from 'preact/hooks';
import type { Correction, Transcript, Turn } from '../types';
import { Top, ErrorBox } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { MODE_LABELS } from '../engine/scheduler';
import { db, getKV, getProfile, saveProfile, setKV, useLive } from '../services/db';
import { chat, chatJson, friendlyError } from '../services/ai/router';
import { summarySystem, teacherSystem } from '../services/ai/prompts';
import { addPracticeSeconds, completeTask, learnerCtx, markActiveToday, previousScores } from '../services/learning';
import { verifyCorrections, scoreSession, compareToPrevious } from '../engine/scoring';
import { sessionMetrics } from '../engine/metrics';
import { speak, stopSpeaking } from '../services/speech/tts';
import { go } from '../router';
import { ScoreGrid, CorrectionCard, MetricsPanel, InlineFix } from '../ui/Report';
import { analyzeWeaknesses, recommendMode } from '../engine/recommender';
import { dayIndexOf } from '../engine/scheduler';

const MODE_ICON: Record<string, string> = { friendly: 'spark', daily: 'home', professional: 'briefcase', college: 'book', workplace: 'briefcase', travel: 'target', public: 'volume', group: 'user', debate: 'brain', interview: 'briefcase', presentation: 'chart', situational: 'refresh' };

// Opening questions are local (no tokens spent). The AI takes over from the learner's first answer.
const OPENERS: Record<string, string[]> = {
  friendly: ['Hi! I’m Maya. What did you do for fun last weekend?', 'Hey! What kind of films or shows do you enjoy these days?', 'Hello! If you had a free day tomorrow, how would you spend it?'],
  daily: ['Hi! Tell me about your day so far – what have you done since you woke up?', 'Hello! What do you usually eat for breakfast, and who makes it?', 'Hi! How do you usually travel to college or work?'],
  professional: ['Good morning. Could you give me a quick update on what you are working on this week?', 'Hello. Imagine we just met at a conference – could you introduce yourself professionally?'],
  college: ['Hi! Which subject are you enjoying most this semester, and why?', 'Hey! Tell me about a project or assignment you are working on right now.'],
  workplace: ['Hi, it’s your team lead. How is your current task going – any blockers?', 'Good morning! Can you walk me through what you plan to finish today?'],
  travel: ['Welcome to the hotel! Do you have a reservation with us?', 'Hello, this is the railway enquiry desk. How can I help you today?'],
  public: ['Let’s practise a short speech. In one minute, tell me why reading books is important.', 'Give a 60-second speech introducing your hometown to visitors.'],
  group: ['Welcome to our group discussion. Today’s topic: “Should mobile phones be banned in classrooms?” Arjun thinks yes. What’s your view?'],
  debate: [
    'Debate time! Motion: “Online learning is better than classroom learning.” You argue FOR it, I argue AGAINST. Give me your opening argument – or name any other topic you want to fight about.',
    'Debate time! Motion: “Social media does more harm than good.” You argue FOR it, I argue AGAINST. Your opening argument, please – or suggest your own topic.',
    'Debate time! Motion: “AI will create more jobs than it destroys.” You argue FOR it, I’ll argue AGAINST. Make your opening point – or pick a different topic.',
  ],
  interview: ['Good morning, thanks for coming in. Let’s start – could you tell me a little about yourself?'],
  presentation: ['Let’s rehearse your presentation. What is your topic, and how would you open it?'],
  situational: ['Scene: you are at a clinic reception and feeling unwell. I’m the receptionist. “Good morning, how can I help you?”', 'Scene: your online order arrived damaged and you are calling customer care. “Hello, thank you for calling. How may I help?”'],
};

export function TeacherModes() {
  const [rec, setRec] = useState<string>('daily');
  const unfinished = useLive(() => db.sessions.where('type').equals('conversation').filter((s) => !s.endedAt).last(), []);
  useEffect(() => {
    (async () => {
      const p = await getProfile();
      const mistakes = await db.mistakes.toArray();
      const sessions = await db.sessions.toArray();
      setRec(recommendMode(analyzeWeaknesses(sessions, mistakes), p.goals, dayIndexOf()));
    })();
  }, []);
  return (
    <>
      <Top title="AI Teacher" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <p class="muted small" style={{ marginTop: 0 }}>Speak freely. Maya waits until you finish, then replies in text. The correct version of everything you say appears right under your message.</p>
        {unfinished && (
          <div class="notice mb">You have an unfinished {MODE_LABELS[unfinished.mode || ''] || ''} conversation. <button class="btn sm soft" onClick={() => go(`#/teacher/${unfinished.mode}?resume=${unfinished.id}`)}>Resume</button></div>
        )}
        <div class="card tap row mb" onClick={() => go('#/friend')} style={{ gap: 12 }}>
          <div class="task" style={{ padding: 0, border: 'none', background: 'none' }}><div class="ico"><Icon name="spark" size={20} /></div></div>
          <div class="grow"><b>Ask me anything</b><div class="small muted">Talk like with a friend – news, Tamil Nadu, stocks, tech. Live web answers in voice + your English corrected.</div></div>
          <Icon name="chevron" size={18} />
        </div>
        <div class="card hero tap" onClick={() => go(`#/teacher/${rec}`)}>
          <div class="muted small">Recommended for you</div>
          <div class="row between mt">
            <div style={{ fontSize: 20, fontWeight: 700 }}>{MODE_LABELS[rec]}</div>
            <span class="btn white sm"><Icon name="mic" size={16} /> Start</span>
          </div>
          <div class="muted small mt">Based on your recent scores and goals.</div>
        </div>
        <h2>Choose a mode</h2>
        <div class="grid2">
          {Object.entries(MODE_LABELS).map(([id, label]) => (
            <a class="tile" href={`#/teacher/${id}`} style={{ minHeight: 84 }}>
              <div class="ico"><Icon name={MODE_ICON[id] || 'spark'} size={18} /></div>
              <b>{label}</b>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

interface LiveTurn extends Omit<Turn, 'sessionId'> { audioUrl?: string }

export function Conversation({ mode }: { mode: string }) {
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [busy, setBusy] = useState('');
  const [speakingNow, setSpeakingNow] = useState(false);
  const [error, setError] = useState('');
  const [voiceOn, setVoiceOnState] = useState(false);
  const voiceRef = useRef(false);
  const setVoiceOn = (v: boolean) => { voiceRef.current = v; setVoiceOnState(v); saveProfile({ teacherVoice: v }); };
  const [feedback, setFeedback] = useState<'end' | 'turn' | 'realtime'>('end');
  const [report, setReport] = useState<any>(null);
  const [ending, setEnding] = useState(false);
  const sessionId = useRef<number | null>(null);
  const started = useRef(Date.now());
  const summary = useRef('');
  const accent = useRef<'en-US' | 'en-GB'>('en-US');
  const endRef = useRef<HTMLDivElement>(null);
  const storeRec = useRef(true);

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      setFeedback(p.feedbackMode);
      voiceRef.current = !!p.teacherVoice;
      setVoiceOnState(!!p.teacherVoice);
      accent.current = p.accent;
      storeRec.current = p.storeRecordings;
      summary.current = await getKV<string>('teacherMemory', '');
      const resume = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('resume'));
      if (resume) {
        const s = await db.sessions.get(resume);
        if (s && !s.endedAt) {
          sessionId.current = resume;
          started.current = s.startedAt;
          const old = await db.turns.where('sessionId').equals(resume).sortBy('idx');
          setTurns(old.map(({ sessionId: _s, ...t }) => t));
          return;
        }
      }
      const list = OPENERS[mode] || OPENERS.friendly;
      const opener = list[Math.floor(Math.random() * list.length)];
      setTurns([{ idx: 0, role: 'ai', text: opener, ts: Date.now() }]);
      if (voiceRef.current) say(opener);
    })();
    return () => { stopSpeaking(); };
  }, [mode]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, busy]);

  async function say(text: string) {
    setSpeakingNow(true);
    try { await speak(text, { lang: accent.current }); } finally { setSpeakingNow(false); }
  }

  async function ensureSession(): Promise<number> {
    if (sessionId.current) return sessionId.current;
    const id = await db.sessions.add({ type: 'conversation', mode, title: MODE_LABELS[mode], startedAt: started.current, durationSec: 0, speakingSec: 0, mistakeCount: 0 });
    sessionId.current = id;
    const first = turns[0];
    if (first) await db.turns.add({ sessionId: id, idx: 0, role: 'ai', text: first.text, ts: first.ts });
    return id;
  }

  async function onUser(r: CaptureResult) {
    setError('');
    const sid = await ensureSession();
    let recordingId: number | undefined;
    let audioUrl: string | undefined;
    if (r.blob && storeRec.current) {
      recordingId = await db.recordings.add({ sessionId: sid, blob: r.blob, mime: r.blob.type, durationSec: r.durationSec, createdAt: Date.now() });
      audioUrl = URL.createObjectURL(r.blob);
    }
    const userTurn: LiveTurn = { idx: turns.length, role: 'user', text: r.transcript.text, ts: Date.now(), transcript: r.transcript, recordingId, audioUrl };
    const next = [...turns, userTurn];
    setTurns(next);
    const userTurnId = await db.turns.add({ sessionId: sid, idx: userTurn.idx, role: 'user', text: userTurn.text, ts: userTurn.ts, transcript: r.transcript, recordingId });
    await respond(next, sid, userTurnId);
  }

  async function respond(history: LiveTurn[], sid: number, userTurnId: number) {
    setBusy('Maya is thinking…');
    try {
      const ctx = await learnerCtx(summary.current);
      const messages = history.map((t) => ({ role: t.role === 'ai' ? ('assistant' as const) : ('user' as const), content: t.role === 'ai' ? JSON.stringify({ reply: t.text }) : t.text }));
      const res = await chatJson<{ reply: string; corrected?: string; natural?: string; corrections?: Correction[]; relevance?: number }>({ purpose: 'teacher', system: teacherSystem(mode, ctx, feedback), messages, tier: 'fast', maxTokens: 900, temperature: 0.6 });
      const fix = typeof res.corrected === 'string' && res.corrected.trim() ? { corrected: res.corrected.trim().slice(0, 2000), natural: typeof res.natural === 'string' ? res.natural.trim().slice(0, 2000) : undefined } : undefined;
      const last = history[history.length - 1];
      const verified = verifyCorrections(last.text, Array.isArray(res.corrections) ? res.corrections : []);
      if (userTurnId) await db.turns.update(userTurnId, { corrections: verified, fix, relevance: typeof res.relevance === 'number' ? res.relevance : undefined });
      const reply = String(res.reply || '').slice(0, 1200) || 'Could you tell me a bit more?';
      const aiTurn: LiveTurn = { idx: history.length, role: 'ai', text: reply, ts: Date.now() };
      setTurns((t) => t.map((x) => (x.idx === last.idx ? { ...x, corrections: verified, fix, relevance: res.relevance } : x)).concat(aiTurn));
      await db.turns.add({ sessionId: sid, idx: aiTurn.idx, role: 'ai', text: reply, ts: aiTurn.ts });
      setBusy('');
      if (voiceRef.current) say(reply);
      // keep a compact rolling summary instead of resending long histories
      const userCount = history.filter((t) => t.role === 'user').length;
      if (userCount > 0 && userCount % 8 === 0) {
        chat({ purpose: 'summary', system: summarySystem, messages: [{ role: 'user', content: history.map((t) => `${t.role}: ${t.text}`).join('\n').slice(-5000) }], tier: 'fast', maxTokens: 150 })
          .then((s) => { summary.current = s.text.trim(); }).catch(() => {});
      }
    } catch (e) {
      setBusy('');
      setError(friendlyError(e));
    }
  }

  async function retryLast() {
    const sid = await ensureSession();
    const last = [...turns].reverse().find((t) => t.role === 'user');
    if (!last) return;
    const row = await db.turns.where('[sessionId+idx]').equals([sid, last.idx]).first();
    await respond(turns, sid, row?.id || 0);
  }

  async function endSession() {
    stopSpeaking();
    const userTurns = turns.filter((t) => t.role === 'user');
    if (!userTurns.length) { go('#/teacher'); return; }
    setEnding(true);
    const transcripts: Transcript[] = userTurns.map((t) => t.transcript || { text: t.text, durationSec: 0, engine: 'typed' });
    const corrections = userTurns.flatMap((t) => t.corrections || []);
    const allRel = userTurns.map((t) => t.relevance).filter((x): x is number => typeof x === 'number');
    const metrics = sessionMetrics(transcripts)!;
    const full = userTurns.map((t) => t.text).join(' ');
    const r = scoreSession({ transcript: full, metrics, corrections, relevance: allRel.length ? allRel.reduce((a, b) => a + b, 0) / allRel.length : undefined });
    const prev = await previousScores('conversation');
    const delta = compareToPrevious(r.scores, prev);
    const durationSec = (Date.now() - started.current) / 1000;
    const speakingSec = transcripts.reduce((a, t) => a + (t.words?.length ? t.words[t.words.length - 1].end - t.words[0].start : t.durationSec || 0), 0);
    const sid = sessionId.current!;
    await db.sessions.update(sid, { endedAt: Date.now(), durationSec: Math.min(durationSec, 4 * 3600), speakingSec, scores: r.scores, metrics, mistakeCount: r.verified.length, report: { fluencyPartial: r.fluencyPartial, delta } });
    await db.mistakes.bulkAdd(r.verified.map((c) => ({ sessionId: sid, ts: Date.now(), category: c.category || 'other', original: c.original, corrected: c.corrected, natural: c.natural || c.corrected, why: c.why, practice: c.practice })));
    await addPracticeSeconds(durationSec, speakingSec);
    await markActiveToday();
    await completeTask(mode === 'interview' ? 'interview' : 'speaking', r.scores.overall);
    chat({ purpose: 'summary', system: summarySystem, messages: [{ role: 'user', content: turns.map((t) => `${t.role}: ${t.text}`).join('\n').slice(-5000) }], tier: 'fast', maxTokens: 150 })
      .then((s) => setKV('teacherMemory', s.text.trim().slice(0, 600))).catch(() => {});
    setReport({ ...r, metrics, delta });
    setEnding(false);
  }

  if (report) {
    return (
      <>
        <Top title="Session report" backTo="#/teacher" />
        <div class="screen no-nav">
          <ScoreGrid scores={report.scores} delta={report.delta} fluencyPartial={report.fluencyPartial} />
          <h2>Corrections ({report.verified.length})</h2>
          {report.verified.length === 0 ? <div class="card small muted">No grammar mistakes were found in what you said. Try a harder mode to stretch yourself.</div> :
            <div class="stack">{report.verified.map((c: Correction) => <CorrectionCard c={c} />)}</div>}
          <h2>Speaking analysis</h2>
          <MetricsPanel m={report.metrics} />
          <div class="row mt2">
            <button class="btn ghost grow" onClick={() => go('#/home')}>Home</button>
            <button class="btn grow" onClick={() => go(`#/teacher/${mode}?n=${Date.now()}`)}>New conversation</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Top title={MODE_LABELS[mode] || 'Conversation'} backTo="#/teacher" right={
        <button class="icon-btn" aria-label={voiceOn ? 'Mute teacher voice' : 'Unmute teacher voice'} onClick={() => { setVoiceOn(!voiceOn); stopSpeaking(); }} title={voiceOn ? 'Teacher voice on' : 'Teacher voice off'}>
          <Icon name={voiceOn ? 'volume' : 'mute'} size={20} />
        </button>
      } />
      <div class="screen no-nav" style={{ paddingTop: 6 }}>
        <div class="chat" aria-live="polite">
          {turns.map((t) => (
            <>
            <div class={`bubble ${t.role === 'ai' ? 'ai' : 'me'}`}>
              {t.text}
              <div class="meta">
                {t.role === 'ai' && <button onClick={() => say(t.text)}>Replay</button>}
                {t.role === 'user' && t.audioUrl && <button onClick={() => new Audio(t.audioUrl).play()}>Play my voice</button>}
                {t.role === 'user' && t.transcript?.engine === 'typed' && <span>typed</span>}
              </div>
            </div>
            {t.role === 'user' && <InlineFix said={t.text} fix={t.fix} corrections={t.corrections} transcript={t.transcript} />}
            </>
          ))}
          {busy && <div class="bubble ai"><span class="spinner" /></div>}
          <div ref={endRef} />
        </div>
        {error && <div class="mt"><ErrorBox error={error} onRetry={retryLast} /></div>}
        <div class="dock">
          <SpeakCapture onSubmit={onUser} busy={busy} speaking={speakingNow} />
          <div class="row mt" style={{ justifyContent: 'center' }}>
            <button class="btn sm ghost" disabled={ending || !!busy} onClick={endSession}>{ending ? 'Analysing…' : 'End & get feedback'}</button>
          </div>
        </div>
      </div>
    </>
  );
}

