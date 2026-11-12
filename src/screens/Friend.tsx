// "Ask me anything": a voice friend that answers any question (with live Google Search for news,
// prices, current events) and still corrects the learner's English under every message.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Turn } from '../types';
import { Top, ErrorBox } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { InlineFix } from '../ui/Report';
import { chat, friendlyError } from '../services/ai/router';
import { friendSystem } from '../services/ai/prompts';
import { addPracticeSeconds, learnerCtx, markActiveToday } from '../services/learning';
import { db, getProfile, saveProfile } from '../services/db';
import { speak, stopSpeaking } from '../services/speech/tts';

interface LiveTurn extends Omit<Turn, 'sessionId'> { audioUrl?: string }

export function parseFriend(text: string) {
  const get = (k: string) => {
    const m = new RegExp(`${k}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:REPLY|CORRECTED|NATURAL|TIPS):|$)`, 'i').exec(text);
    return m ? m[1].trim() : '';
  };
  const reply = get('REPLY') || text.split(/\n\s*CORRECTED:/i)[0].replace(/^REPLY:\s*/i, '').trim();
  const tips = get('TIPS');
  return {
    reply: reply.replace(/\*\*/g, ''),
    corrected: get('CORRECTED'),
    natural: get('NATURAL'),
    tips: /^none\.?$/i.test(tips) || !tips ? [] : tips.split('|').map((t) => t.trim()).filter(Boolean).slice(0, 3),
  };
}

const STARTERS = ['What is the top news in Tamil Nadu today?', 'What happened to Nvidia stock this week?', 'Explain how AI chatbots like Claude work.', 'Suggest a good Tamil thriller movie to watch.'];

export function Friend() {
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceRef = useRef(true);
  const sessionId = useRef<number | null>(null);
  const started = useRef(Date.now());
  const lastInput = useRef<CaptureResult | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const accent = useRef<'en-US' | 'en-GB'>('en-US');

  useEffect(() => {
    getProfile().then((p) => { accent.current = p.accent; const v = (p as any).friendVoice !== false; voiceRef.current = v; setVoiceOn(v); });
    return () => { stopSpeaking(); finish(); };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, busy]);

  async function finish() {
    if (!sessionId.current) return;
    const dur = (Date.now() - started.current) / 1000;
    await db.sessions.update(sessionId.current, { endedAt: Date.now(), durationSec: dur });
  }

  async function say(text: string) {
    setSpeaking(true);
    try { await speak(text, { lang: accent.current }); } finally { setSpeaking(false); }
  }

  async function onUser(r: CaptureResult) {
    lastInput.current = r;
    if (!sessionId.current) sessionId.current = await db.sessions.add({ type: 'friend', title: 'Ask me anything', startedAt: started.current, durationSec: 0, speakingSec: 0, mistakeCount: 0 });
    const userTurn: LiveTurn = { idx: turns.length, role: 'user', text: r.transcript.text, ts: Date.now(), transcript: r.transcript, audioUrl: r.blob ? URL.createObjectURL(r.blob) : undefined };
    const history = [...turns, userTurn];
    setTurns(history);
    await addPracticeSeconds(r.durationSec, r.durationSec);
    await markActiveToday();
    await ask(history);
  }

  async function ask(history: LiveTurn[]) {
    setBusy('Thinking…'); setError('');
    try {
      const ctx = await learnerCtx();
      const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const res = await chat({
        purpose: 'friend', search: true, tier: 'smart', maxTokens: 900, temperature: 0.7,
        system: friendSystem(ctx, today),
        messages: history.slice(-8).map((t) => ({ role: t.role === 'ai' ? ('assistant' as const) : ('user' as const), content: t.text })),
      });
      const p = parseFriend(res.text);
      const last = history[history.length - 1];
      const fix = p.corrected ? { corrected: p.corrected, natural: p.natural || undefined } : undefined;
      const tipCorrections = p.tips.map((t) => {
        const m = /^(.*?)\s*(?:→|->)\s*(.*?)(?:\s*\((.*)\))?$/.exec(t);
        return { original: m?.[1] || t, corrected: m?.[2] || '', natural: m?.[2] || '', why: m?.[3] || '', category: 'other' as const };
      });
      const aiTurn: LiveTurn = { idx: history.length, role: 'ai', text: p.reply || 'Sorry, could you say that again?', ts: Date.now(), sources: res.sources };
      setTurns(history.map((t) => (t.idx === last.idx ? { ...t, fix, corrections: tipCorrections } : t)).concat(aiTurn));
      if (sessionId.current) {
        await db.turns.bulkAdd([
          { sessionId: sessionId.current, idx: last.idx, role: 'user', text: last.text, ts: last.ts, transcript: last.transcript, fix },
          { sessionId: sessionId.current, idx: aiTurn.idx, role: 'ai', text: aiTurn.text, ts: aiTurn.ts },
        ]);
      }
      setBusy('');
      if (voiceRef.current) say(aiTurn.text);
    } catch (e) {
      setBusy('');
      setError(friendlyError(e));
    }
  }

  function toggleVoice() {
    const v = !voiceOn; voiceRef.current = v; setVoiceOn(v); stopSpeaking();
    saveProfile({ friendVoice: v } as any);
  }

  return (
    <>
      <Top title="Ask me anything" backTo={true} right={<button class="icon-btn" aria-label={voiceOn ? 'Mute voice' : 'Unmute voice'} onClick={toggleVoice}><Icon name={voiceOn ? 'volume' : 'mute'} size={20} /></button>} />
      <div class="screen no-nav" style={{ paddingTop: 6 }}>
        {turns.length === 0 && (
          <div class="card">
            <b>Talk to me about anything 👋</b>
            <div class="small muted mt">News, politics, stocks, tech, studies, life – I search the web for live answers and reply in voice. Under each message I show the correct English version of what you said.</div>
            <div class="stack mt">{STARTERS.map((q) => <button class="opt" style={{ marginTop: 0 }} onClick={() => onUser({ transcript: { text: q, durationSec: 0, engine: 'typed' }, durationSec: 0 })}>{q}</button>)}</div>
          </div>
        )}
        <div class="chat" aria-live="polite">
          {turns.map((t) => (
            <>
              <div class={`bubble ${t.role === 'ai' ? 'ai' : 'me'}`}>
                {t.text}
                <div class="meta">
                  {t.role === 'ai' && <button onClick={() => say(t.text)}>Replay</button>}
                  {t.role === 'user' && t.audioUrl && <button onClick={() => new Audio(t.audioUrl).play()}>Play my voice</button>}
                </div>
                {t.role === 'ai' && !!t.sources?.length && (
                  <div class="sources">Sources: {t.sources.map((s) => <a href={s.uri} target="_blank" rel="noopener noreferrer">{s.title.slice(0, 40)}</a>)}</div>
                )}
              </div>
              {t.role === 'user' && <InlineFix said={t.text} fix={t.fix} corrections={t.corrections} transcript={t.transcript} />}
            </>
          ))}
          {busy && <div class="bubble ai"><span class="spinner" /></div>}
          <div ref={endRef} />
        </div>
        {error && <div class="mt"><ErrorBox error={error} onRetry={() => ask(turns)} /></div>}
        <div class="dock">
          <SpeakCapture onSubmit={onUser} busy={busy} speaking={speaking} review={false} hint="Ask me anything" />
        </div>
      </div>
    </>
  );
}
