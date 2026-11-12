// Reusable voice capture: record → transcribe → review/edit (confidence-aware) → submit.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Transcript } from '../types';
import { Recorder } from '../services/speech/recorder';
import { LiveRecognizer, sttAvailability, transcribe, webSpeechSupported } from '../services/speech/stt';
import { getProfile, saveProfile } from '../services/db';
import { AIError } from '../services/ai/types';
import { Icon } from './icons';
import { Modal, fmtTime } from './components';
import { go } from '../router';
import { stopSpeaking } from '../services/speech/tts';

export interface CaptureResult { transcript: Transcript; blob?: Blob; durationSec: number }

interface Props {
  onSubmit: (r: CaptureResult) => void | Promise<void>;
  busy?: string; // external status e.g. "Maya is thinking…"
  speaking?: boolean;
  maxSec?: number; // hard cap, auto-stops
  countdown?: boolean; // show remaining time of maxSec
  review?: boolean; // show editable transcript before submit (default true)
  allowTyping?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onRecordingChange?: (rec: boolean) => void;
  onFirstVoice?: (latencySec: number) => void;
  autoStart?: boolean;
  hint?: string;
}

const NUDGES = ['Keep going! Try “Let me think…”', 'Don’t stop – say “The thing is…”', 'Keep talking – “What I mean is…”', 'Keep going – “Another point is…”'];

type Phase = 'idle' | 'recording' | 'transcribing' | 'review' | 'typing';

export function SpeakCapture(p: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [levels, setLevels] = useState<number[]>(Array(18).fill(0.05));
  const [elapsed, setElapsed] = useState(0);
  const [partial, setPartial] = useState('');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<CaptureResult | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [engine, setEngine] = useState<'cloud' | 'web' | 'none' | 'loading'>('loading');
  const rec = useRef<Recorder | null>(null);
  const live = useRef<LiveRecognizer | null>(null);
  const tick = useRef<number>();
  const startedAt = useRef(0);
  const voiced = useRef(false);
  const lastVoiceAt = useRef(0);
  const coach = useRef(true);
  const [nudge, setNudge] = useState('');

  useEffect(() => {
    (async () => {
      const a = await sttAvailability();
      setEngine(a.cloud ? 'cloud' : webSpeechSupported() ? 'web' : 'none');
      coach.current = (await getProfile()).pauseCoach !== false;
    })();
    return () => { rec.current?.cancel(); clearInterval(tick.current); };
  }, []);

  useEffect(() => { if (p.autoStart && engine !== 'loading' && phase === 'idle') start(); }, [engine]);
  useEffect(() => { p.onRecordingChange?.(phase === 'recording'); }, [phase]);

  async function start() {
    setErr(''); setWarn(''); setPartial('');
    await stopSpeaking();
    if (engine === 'none') { setPhase('typing'); return; }
    if (engine === 'cloud') {
      const prof = await getProfile();
      if (!prof.cloudAudioConsent) { setConsentOpen(true); return; }
    }
    voiced.current = false;
    startedAt.current = performance.now();
    try {
      if (engine === 'web') {
        live.current = new LiveRecognizer();
        live.current.onPartial = (t) => {
          setPartial(t);
          if (!voiced.current && t) { voiced.current = true; p.onFirstVoice?.((performance.now() - startedAt.current) / 1000); }
        };
        live.current.start((await getProfile()).accent);
      } else {
        rec.current = new Recorder();
        await rec.current.start({
          maxSec: p.maxSec ?? 180,
          onMaxReached: () => stop(),
          noSpeechMs: 8000,
          onNoSpeech: () => setWarn('I can’t hear anything yet – check that the microphone is not blocked and speak a little louder.'),
          onLevel: (l) => {
            setLevels((prev) => [...prev.slice(1), Math.max(0.05, l)]);
            const now = performance.now();
            if (l > 0.18) { lastVoiceAt.current = now; setNudge((n) => (n ? '' : n)); }
            else if (coach.current && voiced.current && now - lastVoiceAt.current > 2200) setNudge((n) => n || NUDGES[Math.floor(Math.random() * NUDGES.length)]);
            if (!voiced.current && l > 0.18) { voiced.current = true; setWarn(''); p.onFirstVoice?.((performance.now() - startedAt.current) / 1000); }
          },
        });
      }
      setPhase('recording');
      setElapsed(0);
      tick.current = window.setInterval(() => {
        const e = (performance.now() - startedAt.current) / 1000;
        setElapsed(e);
        if (engine === 'web' && p.maxSec && e >= p.maxSec) stop();
      }, 250);
    } catch (e: any) {
      setPhase('idle');
      if (e?.code === 'permission') setErr('Microphone permission is off. Allow it in Android Settings → Apps → English Mastery → Permissions → Microphone, then try again.');
      else if (e?.code === 'nomic') setErr('No microphone was found.');
      else if (e?.code === 'unsupported') { setEngine('none'); setPhase('typing'); }
      else setErr(e?.message || 'Could not start recording.');
    }
  }

  async function stop() {
    clearInterval(tick.current);
    setNudge('');
    if (engine === 'web' && live.current) {
      setPhase('transcribing');
      const t = await live.current.stop();
      live.current = null;
      afterTranscript({ transcript: t, durationSec: t.durationSec });
      return;
    }
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setPhase('transcribing');
    try {
      const res = await r.stop();
      if (res.durationSec < 0.8) { setPhase('idle'); setWarn('That was very short – hold on and speak a full sentence.'); return; }
      const t = await transcribe(res.blob, res.durationSec, res.voicedRatio);
      afterTranscript({ transcript: t, blob: res.blob, durationSec: res.durationSec });
    } catch (e) {
      setPhase('idle');
      if (e instanceof AIError && e.message === 'consent-required') { setConsentOpen(true); return; }
      setErr(e instanceof AIError ? e.message : 'Transcription failed. You can type your answer instead.');
    }
  }

  function afterTranscript(r: CaptureResult) {
    setPending(r);
    setDraft(r.transcript.text);
    if (r.transcript.lowConfidence) setWarn(`${r.transcript.lowConfidenceReason || 'Recognition was unclear.'} Please check the text below, fix any wrong words, or record again. I won’t judge words I may have misheard.`);
    if (p.review === false && !r.transcript.lowConfidence && r.transcript.text) { submit(r, r.transcript.text); return; }
    setPhase('review');
  }

  async function submit(r: CaptureResult | null, text: string) {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 4000);
    if (!clean) { setWarn('Nothing to send yet.'); return; }
    const base: CaptureResult = r || { transcript: { text: clean, durationSec: 0, engine: 'typed' }, durationSec: 0 };
    const edited = base.transcript.text.trim() !== clean;
    // If the learner corrected the recogniser, keep timings only when the word count is unchanged.
    const sameLen = base.transcript.words && base.transcript.words.length === clean.split(' ').length;
    const transcript: Transcript = { ...base.transcript, text: clean, words: edited && !sameLen ? undefined : base.transcript.words, lowConfidence: false };
    setPhase('idle'); setPending(null); setDraft(''); setWarn('');
    await p.onSubmit({ ...base, transcript });
  }

  async function giveConsent() {
    await saveProfile({ cloudAudioConsent: true });
    setConsentOpen(false);
    setTimeout(start, 50);
  }

  const busy = !!p.busy || phase === 'transcribing';
  const statusText = phase === 'recording' ? 'Listening… tap to stop when you finish' : phase === 'transcribing' ? 'Processing your speech…' : p.speaking ? 'Speaking…' : p.busy || (engine === 'none' ? 'Type your answer' : p.hint || 'Tap the mic and speak');

  return (
    <div>
      {nudge && phase === 'recording' && <div class="nudge" role="status">⏩ {nudge}</div>}
      {err && <div class="notice bad mb" role="alert">{err}</div>}
      {warn && <div class="notice mb" role="status">{warn}</div>}
      {engine === 'none' && phase !== 'typing' && (
        <div class="notice info mb small">Voice input needs a free Groq or Gemini key (or Chrome’s built-in recogniser). <a href="#/settings/keys" onClick={(e) => { e.preventDefault(); go('#/settings/keys'); }}>Add a key</a> – or type for now.</div>
      )}

      {phase === 'review' && (
        <div class="card mb">
          <div class="row between"><span class="label">What I heard</span>{pending?.transcript.confidence !== undefined && <span class={`badge ${pending.transcript.confidence > 0.75 ? 'good' : 'warn'}`}>clarity {Math.round(pending.transcript.confidence * 100)}%</span>}</div>
          <textarea class="input mt" aria-label="Recognised text – edit if needed" value={draft} onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)} />
          <div class="tiny muted mt">Fix any word the app misheard before sending.</div>
          <div class="row mt">
            <button class="btn ghost grow" onClick={() => { setPhase('idle'); setPending(null); start(); }}><Icon name="refresh" size={18} /> Re-record</button>
            <button class="btn grow" onClick={() => submit(pending, draft)}><Icon name="send" size={18} /> Send</button>
          </div>
        </div>
      )}

      {phase === 'typing' && (
        <div class="card mb">
          <textarea class="input" placeholder="Type what you want to say…" value={draft} onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)} aria-label="Type your answer" />
          <div class="row mt">
            {engine !== 'none' && <button class="btn ghost" onClick={() => { setPhase('idle'); setDraft(''); }}><Icon name="mic" size={18} /></button>}
            <button class="btn grow" onClick={() => submit(null, draft)} disabled={!draft.trim() || !!p.busy}><Icon name="send" size={18} /> Send</button>
          </div>
        </div>
      )}

      {phase !== 'review' && phase !== 'typing' && (
        <div class="mic-wrap">
          {phase === 'recording' && engine === 'web' && partial && <div class="card soft small" style={{ width: '100%' }}>{partial}</div>}
          {phase === 'recording' && engine === 'cloud' && (
            <div class="wave" aria-hidden="true">{levels.map((l) => <i style={{ height: `${6 + l * 28}px` }} />)}</div>
          )}
          <div class="status" aria-live="polite">
            {phase === 'recording' && <span class="dot" />}
            {busy && <span class="dot think" />}
            {p.speaking && <span class="dot speak" />}
            {statusText}
            {phase === 'recording' && <span class="num muted"> · {p.countdown && p.maxSec ? fmtTime(p.maxSec - elapsed) + ' left' : fmtTime(elapsed)}</span>}
          </div>
          <div class="row" style={{ gap: 18 }}>
            {p.allowTyping !== false && phase === 'idle' && (
              <button class="icon-btn" aria-label="Type instead" onClick={() => setPhase('typing')} disabled={busy}><Icon name="type" /></button>
            )}
            <button
              class={`mic ${phase === 'recording' ? 'rec' : ''}`}
              aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
              disabled={p.disabled || busy || engine === 'loading'}
              onClick={() => (phase === 'recording' ? stop() : start())}
            >
              {busy ? <span class="spinner" style={{ borderTopColor: '#fff' }} /> : <Icon name={phase === 'recording' ? 'stop' : 'mic'} size={30} />}
            </button>
            {p.allowTyping !== false && phase === 'idle' && <span style={{ width: 40 }} />}
          </div>
        </div>
      )}

      <Modal open={consentOpen} onClose={() => setConsentOpen(false)}>
        <h3>Send voice to the speech service?</h3>
        <p class="small muted">To turn your voice into text, each recording you make is sent to the speech provider whose key you added (Groq, or Google Gemini as fallback). Nothing is recorded unless you press the mic. Recordings are kept only on this phone (you can turn this off or delete them in Privacy).</p>
        <p class="small muted">Free tiers may let the provider use data to improve their services – check their terms. Don’t say private information you wouldn’t want to share.</p>
        <div class="row mt">
          <button class="btn ghost grow" onClick={() => { setConsentOpen(false); setPhase('typing'); }}>Type instead</button>
          <button class="btn grow" onClick={giveConsent}>I agree</button>
        </div>
      </Modal>
    </div>
  );
}
