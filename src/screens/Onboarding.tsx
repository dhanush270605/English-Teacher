import { useState } from 'preact/hooks';
import { Segmented, toast } from '../ui/components';
import { Icon } from '../ui/icons';
import { saveProfile } from '../services/db';
import { setSecret } from '../services/platform';
import { requestNotificationPermission, syncNotifications } from '../notifications/notify';
import { ensureTodayPlan } from '../services/learning';
import { go } from '../router';

const GOALS = [{ id: 'fluency', label: 'Speak fluently' }, { id: 'interviews', label: 'Crack interviews' }, { id: 'grammar', label: 'Fix grammar' }, { id: 'vocabulary', label: 'More vocabulary' }, { id: 'professional', label: 'Professional English' }, { id: 'confidence', label: 'Speak without fear' }, { id: 'pronunciation', label: 'Clear pronunciation' }];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState<string[]>(['fluency']);
  const [minutes, setMinutes] = useState(30);
  const [words, setWords] = useState(5);
  const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');
  const [level, setLevel] = useState('B1');
  const [groq, setGroq] = useState('');
  const [gem, setGem] = useState('');
  const [consent, setConsent] = useState(true);

  async function finish(toAssessment: boolean) {
    try {
      if (groq.trim()) await setSecret('groqKey', groq);
      if (gem.trim()) await setSecret('geminiKey', gem);
    } catch (e: any) { toast(e.message); setStep(2); return; }
    await saveProfile({ name: name.trim().slice(0, 40), goals, dailyMinutes: minutes, wordsPerDay: words, accent, level: toAssessment ? 'unknown' : level, levelSource: 'self', difficulty: { A2: 2, B1: 3, B2: 4, C1: 5 }[level] || 3, cloudAudioConsent: consent && !!(groq || gem), onboarded: true, createdAt: Date.now() });
    await requestNotificationPermission().catch(() => {});
    await syncNotifications().catch(() => {});
    await ensureTodayPlan(true).catch(() => {});
    go(toAssessment ? '#/assessment' : '#/home');
  }

  return (
    <div class="screen no-nav" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top))' }}>
      <div class="row" style={{ gap: 6, marginBottom: 18 }}>{[0, 1, 2, 3].map((i) => <div class="bar grow" style={{ height: 4 }}><i style={{ width: i <= step ? '100%' : '0%' }} /></div>)}</div>
      {step === 0 && (
        <>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--hero)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="mic" size={32} /></div>
          <h1 style={{ fontSize: 28, letterSpacing: '-0.02em', margin: '18px 0 6px' }}>Your personal English coach</h1>
          <p class="muted">Speak every day without fear. Make mistakes, see exactly what to fix, and practise again – until English feels natural.</p>
          <label class="field mt2"><span>What should I call you?</span><input class="input" maxLength={40} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Your name" /></label>
          <button class="btn block" onClick={() => setStep(1)}>Continue</button>
        </>
      )}
      {step === 1 && (
        <>
          <h2 style={{ marginTop: 0 }}>What do you want to achieve?</h2>
          <div class="chips" style={{ flexWrap: 'wrap' }}>{GOALS.map((g) => <button class={`chip ${goals.includes(g.id) ? 'on' : ''}`} onClick={() => setGoals(goals.includes(g.id) ? goals.filter((x) => x !== g.id) : [...goals, g.id])}>{g.label}</button>)}</div>
          <div class="label mt2 mb">Daily practice time</div>
          <Segmented value={minutes} onChange={setMinutes} options={[10, 20, 30, 45, 60].map((m) => ({ value: m, label: `${m} min` }))} />
          <div class="label mt mb">New words per day</div>
          <Segmented value={words} onChange={setWords} options={[3, 5, 8, 10].map((m) => ({ value: m, label: String(m) }))} />
          <div class="label mt mb">Accent to learn</div>
          <Segmented value={accent} onChange={setAccent} options={[{ value: 'en-US', label: 'American' }, { value: 'en-GB', label: 'British' }]} />
          <div class="label mt mb">Your English right now (rough guess)</div>
          <Segmented value={level} onChange={setLevel} options={[{ value: 'A2', label: 'Basic' }, { value: 'B1', label: 'Intermediate' }, { value: 'B2', label: 'Good' }, { value: 'C1', label: 'Advanced' }]} />
          <div class="row mt2"><button class="btn ghost" onClick={() => setStep(0)}>Back</button><button class="btn grow" onClick={() => setStep(2)}>Continue</button></div>
        </>
      )}
      {step === 2 && (
        <>
          <h2 style={{ marginTop: 0 }}>Connect a free AI (2 minutes)</h2>
          <p class="small muted">The teacher, speech recognition and feedback use free AI services with your own key. Keys stay on this phone only.</p>
          <div class="card">
            <b>1. Groq – recommended</b>
            <ol class="small" style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li>Open <b>console.groq.com/keys</b> in Chrome and sign in (Google login works).</li>
              <li>Tap “Create API Key”, copy it.</li>
              <li>Paste it here.</li>
            </ol>
            <input class="input" type="password" autocomplete="off" placeholder="gsk_…" value={groq} onInput={(e) => setGroq((e.target as HTMLInputElement).value)} aria-label="Groq key" />
          </div>
          <div class="card mt">
            <b>2. Google Gemini – optional backup</b>
            <div class="small muted">aistudio.google.com/apikey → Create API key.</div>
            <input class="input mt" type="password" autocomplete="off" placeholder="AIza…" value={gem} onInput={(e) => setGem((e.target as HTMLInputElement).value)} aria-label="Gemini key" />
          </div>
          <label class="row small mt" style={{ alignItems: 'flex-start' }}><input type="checkbox" checked={consent} onChange={(e) => setConsent((e.target as HTMLInputElement).checked)} style={{ marginTop: 4 }} /> I understand my voice recordings are sent to the provider for transcription when I press the mic.</label>
          <div class="row mt2"><button class="btn ghost" onClick={() => setStep(1)}>Back</button><button class="btn grow" onClick={() => setStep(3)}>{groq || gem ? 'Continue' : 'Skip for now'}</button></div>
        </>
      )}
      {step === 3 && (
        <>
          <h2 style={{ marginTop: 0 }}>Find your level?</h2>
          <p class="small muted">A 15-minute assessment (grammar, vocabulary, speaking, listening) gives an informal CEFR estimate so lessons start at the right difficulty. You can do it later.</p>
          <div class="card soft small">Reminders: next, Android will ask to allow notifications – please allow them so daily practice reminders can reach you.</div>
          <button class="btn block mt2" onClick={() => finish(true)}><Icon name="target" size={18} /> Take the assessment</button>
          <button class="btn ghost block mt" onClick={() => finish(false)}>Start learning now</button>
        </>
      )}
    </div>
  );
}
