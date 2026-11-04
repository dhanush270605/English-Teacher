import { useEffect, useRef, useState } from 'preact/hooks';
import { Top, Loading, ErrorBox, Segmented } from '../ui/components';
import { Icon } from '../ui/icons';
import { LISTENING_THEMES } from '../data/content/practice';
import { cacheGet, cacheSet, getProfile, markUsed, saveProfile } from '../services/db';
import { chatJson, friendlyError } from '../services/ai/router';
import { listeningSystem } from '../services/ai/prompts';
import { speak, stopSpeaking } from '../services/speech/tts';
import { completeTask, saveSession } from '../services/learning';

interface Dialogue { title: string; lines: { speaker: string; name: string; text: string }[]; questions: { q: string; options: string[]; answer: number }[] }

export function Listening({ theme: initial }: { theme?: string }) {
  const [theme, setTheme] = useState(initial || LISTENING_THEMES[Math.floor(Math.random() * LISTENING_THEMES.length)]);
  const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');
  const [level, setLevel] = useState('B1');
  const [dlg, setDlg] = useState<Dialogue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showText, setShowText] = useState(false);
  const [saved, setSaved] = useState(false);
  const stopFlag = useRef(false);
  const started = useRef(Date.now());

  useEffect(() => { getProfile().then((p) => { setAccent(p.accent); setLevel(p.level === 'unknown' ? 'B1' : p.level); }); return () => { stopFlag.current = true; stopSpeaking(); }; }, []);

  async function load(fresh = false) {
    setError(''); setLoading(true); setDlg(null); setAnswers([]); setShowText(false); setPlays(0); setSaved(false);
    const key = `listen:${theme}:${level}:${accent}`;
    try {
      let d = fresh ? undefined : await cacheGet<Dialogue>(key);
      if (!d) {
        d = await chatJson<Dialogue>({ purpose: 'listening', system: listeningSystem(level, accent), messages: [{ role: 'user', content: `Theme: ${theme}` }], tier: 'fast', maxTokens: 1200, temperature: 0.8 });
        if (!d?.lines?.length || !d?.questions?.length) throw new Error('bad');
        d.questions = d.questions.filter((q) => Array.isArray(q.options) && q.answer >= 0 && q.answer < q.options.length).slice(0, 5);
        await cacheSet(key, d);
      }
      setDlg(d);
      setAnswers(Array(d.questions.length).fill(null));
      started.current = Date.now();
    } catch (e) { setError(e instanceof Error && e.message === 'bad' ? 'The dialogue could not be created. Try again.' : friendlyError(e)); }
    setLoading(false);
  }

  async function playAll() {
    if (!dlg) return;
    stopFlag.current = false;
    setPlays((p) => p + 1);
    for (let i = 0; i < dlg.lines.length; i++) {
      if (stopFlag.current) break;
      setPlaying(i);
      await speak(dlg.lines[i].text, { lang: accent, pitch: dlg.lines[i].speaker === 'B' ? 1.25 : 0.9, rate: level <= 'A2' ? 0.85 : 1 });
    }
    setPlaying(-1);
  }

  async function finish() {
    if (!dlg || saved) return;
    const correct = answers.filter((a, i) => a === dlg.questions[i].answer).length;
    const score = Math.round((correct / dlg.questions.length) * 100);
    await saveSession({ type: 'listening', title: `Listening: ${theme}`, startedAt: started.current, endedAt: Date.now(), durationSec: (Date.now() - started.current) / 1000, speakingSec: 0, scores: { overall: score }, mistakeCount: 0, report: { theme, correct, total: dlg.questions.length, plays } });
    await markUsed('listening:' + theme);
    await completeTask('listening', score);
    setSaved(true); setShowText(true);
  }

  const allAnswered = dlg && answers.every((a) => a !== null);

  return (
    <>
      <Top title="Listening" />
      <div class="screen" style={{ paddingTop: 4 }}>
        {!dlg && (
          <>
            <div class="label mb">Theme</div>
            <div class="chips" style={{ flexWrap: 'wrap' }}>{LISTENING_THEMES.map((t) => <button class={`chip ${t === theme ? 'on' : ''}`} onClick={() => setTheme(t)}>{t}</button>)}</div>
            <div class="label mt mb">Accent</div>
            <Segmented value={accent} onChange={(a) => { setAccent(a); saveProfile({ accent: a }); }} options={[{ value: 'en-US', label: 'American' }, { value: 'en-GB', label: 'British' }]} />
            {error && <div class="mt"><ErrorBox error={error} onRetry={() => load()} /></div>}
            <button class="btn block mt2" disabled={loading} onClick={() => load()}>{loading ? <span class="spinner" /> : <><Icon name="ear" size={18} /> Create dialogue</>}</button>
            <p class="tiny muted center">Voices use your phone’s text-to-speech engine. Install extra English voices in Android Settings → Text-to-speech for better quality.</p>
          </>
        )}
        {loading && <Loading text="Writing a dialogue…" />}
        {dlg && (
          <>
            <div class="card">
              <div class="row between"><b>{dlg.title || theme}</b><span class="badge">{accent === 'en-GB' ? 'British' : 'American'}</span></div>
              <div class="row mt">
                <button class="btn grow" onClick={playing >= 0 ? () => { stopFlag.current = true; stopSpeaking(); setPlaying(-1); } : playAll}>
                  <Icon name={playing >= 0 ? 'pause' : 'play'} size={18} /> {playing >= 0 ? 'Stop' : plays ? 'Replay' : 'Play dialogue'}
                </button>
              </div>
              <div class="tiny muted mt">Plays: {plays}. Try answering after listening once or twice, without reading.</div>
            </div>
            <h2>Questions</h2>
            {dlg.questions.map((q, i) => (
              <div class="card mb">
                <b>{i + 1}. {q.q}</b>
                {q.options.map((o, k) => (
                  <button class={`opt ${answers[i] !== null && k === q.answer ? 'right' : ''} ${answers[i] === k && k !== q.answer ? 'wrong' : ''}`} disabled={answers[i] !== null} onClick={() => { const a = [...answers]; a[i] = k; setAnswers(a); }}>{o}</button>
                ))}
              </div>
            ))}
            {allAnswered && !saved && <button class="btn block" onClick={finish}>Finish & see transcript</button>}
            {saved && <div class="notice good">Score: {answers.filter((a, i) => a === dlg.questions[i].answer).length}/{dlg.questions.length}</div>}
            {showText && (
              <>
                <h2>Transcript</h2>
                <div class="card">
                  {dlg.lines.map((l, i) => (
                    <div class="list-item" style={{ background: playing === i ? 'var(--accent-soft)' : undefined }}>
                      <div class="grow small"><b>{l.name || l.speaker}:</b> {l.text}</div>
                      <button class="icon-btn" aria-label="US accent" title="American" onClick={() => speak(l.text, { lang: 'en-US' })}>🇺🇸</button>
                      <button class="icon-btn" aria-label="UK accent" title="British" onClick={() => speak(l.text, { lang: 'en-GB' })}>🇬🇧</button>
                    </div>
                  ))}
                </div>
                <p class="tiny muted">Accent familiarity: tap the flags to hear the same line in American and British English.</p>
              </>
            )}
            <div class="row mt2"><button class="btn ghost grow" onClick={() => setDlg(null)}>Change theme</button><button class="btn soft grow" onClick={() => load(true)}>New dialogue</button></div>
          </>
        )}
      </div>
    </>
  );
}
