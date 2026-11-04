import { useEffect, useState } from 'preact/hooks';
import { Top, Loading, Toggle, toast, Segmented, Modal } from '../ui/components';
import { Icon } from '../ui/icons';
import { getSecret, setSecret, maskKey, isNative, isOnline, clearSecrets } from '../services/platform';
import { listModels } from '../services/ai/providers';
import { getAIConfig } from '../services/ai/router';
import { db, getProfile, saveProfile, setKV, useLive, exportAll, clearAll } from '../services/db';
import { DEFAULT_AI_CONFIG, type AIConfig } from '../services/ai/types';
import { getCategories, saveCategories, syncNotifications, notificationStatus, requestNotificationPermission, testNotification, openExactAlarmSettings, type NotifCategory, type NotifStatus } from '../notifications/notify';
import { Recorder } from '../services/speech/recorder';
import { voicesAvailable, speak } from '../services/speech/tts';
import { webSpeechSupported } from '../services/speech/stt';
import { dateKey } from '../engine/scheduler';
import { OVERALL_WEIGHTS } from '../engine/scoring';
import { go } from '../router';

export function KeysSettings() {
  const [groq, setGroq] = useState('');
  const [gem, setGem] = useState('');
  const [have, setHave] = useState({ groq: '', gemini: '' });
  const [cfg, setCfg] = useState<AIConfig | null>(null);
  const [models, setModels] = useState<{ groq?: string[]; gemini?: string[] }>({});
  const [busy, setBusy] = useState('');
  const usage = useLive(() => db.usage.where('date').equals(dateKey()).toArray(), []);

  async function refresh() {
    setHave({ groq: maskKey(await getSecret('groqKey')), gemini: maskKey(await getSecret('geminiKey')) });
    setCfg(await getAIConfig());
  }
  useEffect(() => { refresh(); }, []);

  async function save(which: 'groqKey' | 'geminiKey', v: string) {
    try { await setSecret(which, v); toast(v ? 'Key saved on this phone' : 'Key removed'); setGroq(''); setGem(''); refresh(); } catch (e: any) { toast(e.message); }
  }
  async function test(p: 'groq' | 'gemini') {
    setBusy(p);
    try {
      const k = await getSecret(p === 'groq' ? 'groqKey' : 'geminiKey');
      const list = await listModels(p, k);
      setModels((m) => ({ ...m, [p]: list }));
      toast(`${p === 'groq' ? 'Groq' : 'Gemini'} key works · ${list.length} models available`);
    } catch (e: any) { toast(e.message || 'Key test failed'); }
    setBusy('');
  }
  async function saveCfg(patch: Partial<AIConfig>) {
    const n = { ...cfg!, ...patch };
    setCfg(n);
    await setKV('aiConfig', n);
  }

  if (!cfg) return <><Top title="AI keys" backTo="#/profile" /><Loading /></>;
  const modelSelect = (p: 'groq' | 'gemini', field: keyof AIConfig) => {
    const list = models[p];
    const val = cfg[field] as string;
    return list?.length ? (
      <select class="input" value={val} onChange={(e) => saveCfg({ [field]: (e.target as HTMLSelectElement).value } as any)}>
        {!list.includes(val) && <option value={val}>{val} (not found)</option>}
        {list.map((m) => <option value={m}>{m}</option>)}
      </select>
    ) : <input class="input" value={val} onChange={(e) => saveCfg({ [field]: (e.target as HTMLInputElement).value.trim() } as any)} />;
  };

  return (
    <>
      <Top title="AI keys & usage" backTo="#/profile" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="notice info small">Keys are stored only on this phone and never included in the app. Both providers offer free tiers with daily limits (no card needed at the time of writing – check their pages, terms can change). The app stops before its own daily safety caps.</div>

        <h2>Groq (recommended – voice + teacher)</h2>
        <div class="card">
          <div class="small">Used for speech-to-text (Whisper, with word timings for fluency analysis) and conversation. Get a free key at <b>console.groq.com/keys</b>.</div>
          <div class="small mt">Current: {have.groq ? <span class="badge good">{have.groq}</span> : <span class="badge">not set</span>}</div>
          <div class="row mt"><input class="input grow" type="password" autocomplete="off" placeholder="gsk_…" value={groq} onInput={(e) => setGroq((e.target as HTMLInputElement).value)} aria-label="Groq API key" /><button class="btn" disabled={!groq} onClick={() => save('groqKey', groq)}>Save</button></div>
          {have.groq && <div class="row mt"><button class="btn sm soft" disabled={busy === 'groq'} onClick={() => test('groq')}>{busy === 'groq' ? <span class="spinner" /> : 'Test & load models'}</button><button class="btn sm danger" onClick={() => save('groqKey', '')}>Remove</button></div>}
        </div>

        <h2>Google Gemini (fallback + picture vision)</h2>
        <div class="card">
          <div class="small">Used when Groq is busy, and to look at the picture in picture challenges. Get a free key at <b>aistudio.google.com/apikey</b>. Note: on the free tier Google may use prompts to improve its products.</div>
          <div class="small mt">Current: {have.gemini ? <span class="badge good">{have.gemini}</span> : <span class="badge">not set</span>}</div>
          <div class="row mt"><input class="input grow" type="password" autocomplete="off" placeholder="AIza…" value={gem} onInput={(e) => setGem((e.target as HTMLInputElement).value)} aria-label="Gemini API key" /><button class="btn" disabled={!gem} onClick={() => save('geminiKey', gem)}>Save</button></div>
          {have.gemini && <div class="row mt"><button class="btn sm soft" disabled={busy === 'gemini'} onClick={() => test('gemini')}>{busy === 'gemini' ? <span class="spinner" /> : 'Test & load models'}</button><button class="btn sm danger" onClick={() => save('geminiKey', '')}>Remove</button></div>}
        </div>

        <h2>Provider order & models</h2>
        <div class="card">
          <Segmented value={cfg.order[0]} onChange={(v) => saveCfg({ order: v === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'] })} options={[{ value: 'groq', label: 'Groq first' }, { value: 'gemini', label: 'Gemini first' }]} />
          <label class="field mt"><span>Groq fast model (chat)</span>{modelSelect('groq', 'groqFast')}</label>
          <label class="field"><span>Groq smart model (analysis)</span>{modelSelect('groq', 'groqSmart')}</label>
          <label class="field"><span>Groq speech model</span>{modelSelect('groq', 'whisperModel')}</label>
          <label class="field"><span>Gemini fast model</span>{modelSelect('gemini', 'geminiFast')}</label>
          <label class="field"><span>Gemini smart model (vision)</span>{modelSelect('gemini', 'geminiSmart')}</label>
          <div class="grid2">
            <label class="field"><span>Groq daily cap</span><input class="input" type="number" min={10} max={14000} value={cfg.dailyCap.groq} onChange={(e) => saveCfg({ dailyCap: { ...cfg.dailyCap, groq: Math.max(10, +(e.target as HTMLInputElement).value || 0) } })} /></label>
            <label class="field"><span>Gemini daily cap</span><input class="input" type="number" min={10} max={1500} value={cfg.dailyCap.gemini} onChange={(e) => saveCfg({ dailyCap: { ...cfg.dailyCap, gemini: Math.max(10, +(e.target as HTMLInputElement).value || 0) } })} /></label>
          </div>
          <button class="btn sm ghost" onClick={() => { saveCfg(DEFAULT_AI_CONFIG); toast('Reset to defaults'); }}>Reset to defaults</button>
        </div>

        <h2>Today’s usage</h2>
        <div class="card">
          {!usage?.length ? <div class="small muted">No AI requests today.</div> : usage.map((u) => (
            <div class="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{u.provider}</span>
              <span class="num muted">{u.requests} req · {u.tokensIn + u.tokensOut} tokens{u.audioSec ? ` · ${Math.round(u.audioSec / 60)} min audio` : ''}{u.errors ? ` · ${u.errors} errors` : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function NotificationSettings() {
  const [cats, setCats] = useState<NotifCategory[] | null>(null);
  const [status, setStatus] = useState<NotifStatus | null>(null);
  const [vivo, setVivo] = useState(false);
  const log = useLive(() => db.notifLog.orderBy('ts').reverse().limit(10).toArray(), []);
  async function refresh() { setCats(await getCategories()); setStatus(await notificationStatus()); }
  useEffect(() => { refresh(); }, []);
  async function update(id: string, patch: Partial<NotifCategory>) {
    const n = cats!.map((c) => (c.id === id ? { ...c, ...patch } : c));
    setCats(n);
    await saveCategories(n);
    const r = await syncNotifications();
    setStatus(await notificationStatus());
    if (r.note && isNative()) toast(r.note);
  }
  if (!cats || !status) return <><Top title="Reminders" backTo="#/profile" /><Loading /></>;
  return (
    <>
      <Top title="Reminders" backTo="#/profile" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card">
          <div class="row between"><b>Status</b><button class="btn sm ghost" onClick={refresh}><Icon name="refresh" size={16} /></button></div>
          {!status.supported && <div class="notice small mt">You are using the browser version. Scheduled reminders when the app is closed need the Android app (APK). Browser notifications only work while the page is open.</div>}
          <div class="row between small mt"><span>Notification permission</span><span class={`badge ${status.permission === 'granted' ? 'good' : 'bad'}`}>{status.permission}</span></div>
          {status.exact !== undefined && <div class="row between small"><span>Exact alarms (on-time reminders)</span><span class={`badge ${status.exact === 'granted' ? 'good' : 'warn'}`}>{status.exact}</span></div>}
          {status.supported && <div class="row between small"><span>Scheduled reminders</span><span class="badge num">{status.pending}</span></div>}
          <div class="row wrap mt">
            {status.permission !== 'granted' && <button class="btn sm" onClick={async () => { await requestNotificationPermission(); await syncNotifications(); refresh(); }}>Allow notifications</button>}
            {status.exact && status.exact !== 'granted' && <button class="btn sm soft" onClick={openExactAlarmSettings}>Allow exact alarms</button>}
            <button class="btn sm ghost" onClick={async () => toast(await testNotification(10))}>Send test in 10s</button>
            <button class="btn sm ghost" onClick={() => setVivo(true)}>Not arriving? (Vivo)</button>
          </div>
        </div>
        <h2>Categories</h2>
        <div class="card">
          {cats.filter((c) => c.id !== 'milestones' && c.id !== 'listening').concat(cats.filter((c) => c.id === 'listening' || c.id === 'milestones')).map((c) => (
            <div class="list-item" style={{ cursor: 'default' }}>
              <div class="grow">
                <b class="small">{c.label}</b>
                {c.id !== 'milestones' && (
                  <div class="row wrap mt" style={{ gap: 6 }}>
                    {(c.times.length ? c.times : ['']).map((t, i) => (
                      <input type="time" class="input" style={{ width: 120, minHeight: 36, padding: '4px 8px' }} value={t} aria-label={`${c.label} time`} disabled={!c.enabled}
                        onChange={(e) => { const v = (e.target as HTMLInputElement).value; const times = [...c.times]; if (v) times[i] = v; else times.splice(i, 1); update(c.id, { times }); }} />
                    ))}
                    {c.enabled && c.times.length < 3 && !c.weekday && <button class="btn sm ghost" onClick={() => update(c.id, { times: [...c.times, '12:00'] })}>+ time</button>}
                    {c.weekday && <span class="tiny muted">Sundays</span>}
                  </div>
                )}
              </div>
              <Toggle checked={c.enabled} label={`Enable ${c.label}`} onChange={(v) => update(c.id, { enabled: v, times: v && !c.times.length ? ['12:00'] : c.times })} />
            </div>
          ))}
        </div>
        <p class="tiny muted">Tapping a reminder opens the matching activity. Each reminder has a “Snooze 15 min” action. Delivery depends on Android battery rules – it is not guaranteed.</p>
        {log && log.length > 0 && (
          <><h2>Recent notification activity</h2><div class="card">{log.map((l) => <div class="row between small" style={{ padding: '4px 0' }}><span>{l.category} · {l.event}</span><span class="muted num">{new Date(l.ts).toLocaleString()}</span></div>)}</div></>
        )}
      </div>
      <Modal open={vivo} onClose={() => setVivo(false)}>
        <h3>Make reminders reliable on Vivo (Funtouch OS / OriginOS)</h3>
        <ol class="small" style={{ paddingLeft: 18 }}>
          <li><b>Notifications:</b> Settings → Notifications & status bar → App notifications → English Mastery → allow all, including lock screen.</li>
          <li><b>Background:</b> Settings → Battery → Background power consumption management → English Mastery → <b>Allow</b> (or “Don’t restrict”).</li>
          <li><b>Auto-start:</b> Settings → Apps & permissions → Permission management → Autostart (or i Manager → App manager → Autostart) → turn ON for English Mastery.</li>
          <li><b>Alarms:</b> Settings → Apps → Special access → Alarms & reminders → allow English Mastery (or use the “Allow exact alarms” button).</li>
          <li><b>Lock in recents:</b> open recent apps, pull down on English Mastery (or tap the lock icon) so cleaning doesn’t close it.</li>
          <li>Restart the phone once, open the app (this re-schedules reminders), then use “Send test in 10s” and lock the screen.</li>
        </ol>
        <p class="tiny muted">Menu names differ between Funtouch OS / OriginOS versions. Android may still delay reminders in deep battery saving.</p>
        <button class="btn block" onClick={() => setVivo(false)}>OK</button>
      </Modal>
    </>
  );
}

export function PrivacySettings() {
  const p = useLive(() => getProfile(), []);
  const counts = useLive(async () => ({ rec: await db.recordings.count(), conv: await db.turns.count(), sessions: await db.sessions.count() }), []);
  const [confirm, setConfirm] = useState<'' | 'rec' | 'conv' | 'all'>('');
  if (!p || !counts) return <><Top title="Privacy" backTo="#/profile" /><Loading /></>;
  async function doExport() {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const name = `english-mastery-export-${dateKey()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    if (isNative() && (navigator as any).canShare?.({ files: [file] })) { try { await (navigator as any).share({ files: [file], title: name }); return; } catch { /* fall back */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    toast('Export created');
  }
  async function run() {
    if (confirm === 'rec') await db.recordings.clear();
    if (confirm === 'conv') await db.transaction('rw', [db.turns, db.recordings], async () => { await db.turns.clear(); await db.recordings.clear(); });
    if (confirm === 'all') { await clearAll(); await clearSecrets(); location.hash = '#/onboarding'; location.reload(); }
    setConfirm(''); toast('Deleted');
  }
  return (
    <>
      <Top title="Privacy & data" backTo="#/profile" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="notice info small">Everything (history, scores, recordings) is stored only on this phone. There is no account and no server of ours. Audio is sent to the speech provider only when you press the mic.</div>
        <h2>Recording</h2>
        <div class="card">
          <div class="list-item" style={{ cursor: 'default' }}><div class="grow"><b class="small">Keep my recordings on this phone</b><div class="tiny muted">For replaying your voice. Auto-deleted after 14 days.</div></div><Toggle checked={p.storeRecordings} onChange={(v) => saveProfile({ storeRecordings: v })} label="Store recordings" /></div>
          <div class="list-item" style={{ cursor: 'default' }}><div class="grow"><b class="small">Allow sending audio for transcription</b><div class="tiny muted">Needed for voice input with Groq/Gemini. Off = type, or Chrome’s recogniser in the browser.</div></div><Toggle checked={p.cloudAudioConsent} onChange={(v) => saveProfile({ cloudAudioConsent: v })} label="Cloud transcription consent" /></div>
        </div>
        <h2>Your data</h2>
        <div class="card stack">
          <button class="btn ghost block" onClick={doExport}><Icon name="download" size={18} /> Export learning history (JSON)</button>
          <button class="btn danger block" onClick={() => setConfirm('rec')}><Icon name="trash" size={18} /> Delete all recordings ({counts.rec})</button>
          <button class="btn danger block" onClick={() => setConfirm('conv')}><Icon name="trash" size={18} /> Delete conversation history ({counts.conv} messages)</button>
          <button class="btn danger block" onClick={() => setConfirm('all')}><Icon name="trash" size={18} /> Clear ALL app data & keys</button>
          <div class="tiny muted">Individual recordings and sessions can be deleted from Progress → All sessions.</div>
        </div>
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm('')}>
        <h3>Are you sure?</h3>
        <p class="small muted">{confirm === 'all' ? 'This deletes every session, word, score, recording, setting and API key. It cannot be undone. Consider exporting first.' : 'This cannot be undone.'}</p>
        <div class="row"><button class="btn ghost grow" onClick={() => setConfirm('')}>Cancel</button><button class="btn danger grow" onClick={run}>Delete</button></div>
      </Modal>
    </>
  );
}

const GOALS = [{ id: 'fluency', label: 'Speaking fluency' }, { id: 'interviews', label: 'Interviews' }, { id: 'grammar', label: 'Grammar accuracy' }, { id: 'vocabulary', label: 'Vocabulary' }, { id: 'pronunciation', label: 'Pronunciation' }, { id: 'professional', label: 'Professional communication' }, { id: 'confidence', label: 'Speaking without fear' }];

export function LearningSettings() {
  const p = useLive(() => getProfile(), []);
  if (!p) return <><Top title="Learning" backTo="#/profile" /><Loading /></>;
  return (
    <>
      <Top title="Learning preferences" backTo="#/profile" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <label class="field"><span>Name</span><input class="input" maxLength={40} value={p.name} onChange={(e) => saveProfile({ name: (e.target as HTMLInputElement).value.trim().slice(0, 40) })} /></label>
        <div class="label mb">Goals</div>
        <div class="chips" style={{ flexWrap: 'wrap' }}>{GOALS.map((g) => <button class={`chip ${p.goals.includes(g.id) ? 'on' : ''}`} onClick={() => saveProfile({ goals: p.goals.includes(g.id) ? p.goals.filter((x) => x !== g.id) : [...p.goals, g.id] })}>{g.label}</button>)}</div>
        <div class="label mt mb">Daily practice time</div>
        <Segmented value={p.dailyMinutes} onChange={(v) => saveProfile({ dailyMinutes: v })} options={[10, 20, 30, 45, 60].map((m) => ({ value: m, label: `${m} min` }))} />
        <div class="label mt mb">New words per day</div>
        <Segmented value={p.wordsPerDay} onChange={(v) => saveProfile({ wordsPerDay: v })} options={[3, 5, 8, 10, 15].map((m) => ({ value: m, label: String(m) }))} />
        <div class="label mt mb">Weekly goal</div>
        <Segmented value={p.weeklyGoalMinutes} onChange={(v) => saveProfile({ weeklyGoalMinutes: v })} options={[60, 100, 150, 210, 300].map((m) => ({ value: m, label: `${m} min` }))} />
        <div class="label mt mb">When should corrections appear?</div>
        <Segmented value={p.feedbackMode} onChange={(v) => saveProfile({ feedbackMode: v })} options={[{ value: 'end', label: 'End of session' }, { value: 'turn', label: 'After each turn' }, { value: 'realtime', label: 'Real-time tips' }]} />
        <div class="label mt mb">Accent</div>
        <Segmented value={p.accent} onChange={(v) => saveProfile({ accent: v })} options={[{ value: 'en-US', label: 'American' }, { value: 'en-GB', label: 'British' }]} />
        <div class="label mt mb">Difficulty (adapts automatically)</div>
        <Segmented value={p.difficulty} onChange={(v) => saveProfile({ difficulty: v })} options={[1, 2, 3, 4, 5].map((d) => ({ value: d, label: String(d) }))} />
        <div class="card mt row"><div class="grow"><b class="small">Tamil explanations</b><div class="tiny muted">Short Tamil hints for grammar and words.</div></div><Toggle checked={p.tamilHelp} onChange={(v) => saveProfile({ tamilHelp: v })} label="Tamil help" /></div>
      </div>
    </>
  );
}

export function Diagnostics() {
  const [r, setR] = useState<Record<string, string>>({});
  const [micTest, setMicTest] = useState('');
  useEffect(() => {
    (async () => {
      setR({
        Platform: isNative() ? 'Android app' : 'Browser',
        Online: isOnline() ? 'yes' : 'no',
        'Microphone recording API': Recorder.supported() ? 'available' : 'not available',
        'Chrome speech recogniser': webSpeechSupported() ? 'available (browser only)' : 'not available',
        'US English voice': (await voicesAvailable('en-US')) ? 'yes' : 'no',
        'UK English voice': (await voicesAvailable('en-GB')) ? 'yes' : 'not installed',
        'Groq key': (await getSecret('groqKey')) ? 'set' : 'not set',
        'Gemini key': (await getSecret('geminiKey')) ? 'set' : 'not set',
        'Stored data': `${await db.sessions.count()} sessions, ${await db.recordings.count()} recordings`,
      });
    })();
  }, []);
  async function testMic() {
    setMicTest('Recording 3 seconds…');
    try {
      const rec = new Recorder();
      let peak = 0;
      await rec.start({ onLevel: (l) => { peak = Math.max(peak, l); } });
      await new Promise((res) => setTimeout(res, 3000));
      const out = await rec.stop();
      setMicTest(`OK – ${Math.round(out.blob.size / 1024)} KB recorded, peak level ${Math.round(peak * 100)}%. ${peak < 0.15 ? 'Very quiet – speak closer to the mic.' : ''}`);
      new Audio(URL.createObjectURL(out.blob)).play();
    } catch (e: any) { setMicTest('Failed: ' + e.message); }
  }
  return (
    <>
      <Top title="Diagnostics" backTo="#/profile" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card">{Object.entries(r).map(([k, v]) => <div class="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><span class="muted">{k}</span><b>{v}</b></div>)}</div>
        <div class="card mt">
          <b>Microphone test</b>
          <div class="small muted">Records 3 seconds locally and plays it back. Nothing is uploaded.</div>
          <button class="btn sm mt" onClick={testMic}><Icon name="mic" size={16} /> Test microphone</button>
          {micTest && <div class="small mt">{micTest}</div>}
        </div>
        <div class="card mt">
          <b>Voice test</b>
          <div class="row mt"><button class="btn sm ghost" onClick={() => speak('Hello! This is the American voice.', { lang: 'en-US' })}>🇺🇸 Test</button><button class="btn sm ghost" onClick={() => speak('Hello! This is the British voice.', { lang: 'en-GB' })}>🇬🇧 Test</button></div>
          <div class="tiny muted mt">If a voice is missing: Android Settings → System → Languages → Text-to-speech → Google → install English (UK/US) voice data.</div>
        </div>
        <button class="btn ghost block mt" onClick={() => go('#/notifications')}><Icon name="bell" size={18} /> Notification diagnostics</button>
      </div>
    </>
  );
}


export function About() {
  return (
    <>
      <Top title="About & limitations" backTo="#/profile" />
      <div class="screen small" style={{ paddingTop: 4 }}>
        <div class="card stack">
          <div><b>How scores are calculated</b><br />Every score comes from a fixed formula over measured evidence – never a number invented by the AI. Grammar uses only corrections whose exact words appear in your transcript. Fluency uses word timings (pauses, words between pauses, fillers, rate). Vocabulary uses lexical diversity (MTLD) and the share of less-common words. Overall weights: {Object.entries(OVERALL_WEIGHTS).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ')}.</div>
          <div><b>Pronunciation is approximate.</b> It reflects how clearly a speech recogniser understood you, not phoneme-by-phoneme accent analysis.</div>
          <div><b>Speech recognition is not perfect.</b> Accent, noise, microphone and network affect it. You can always edit the text before it is judged; unclear recordings are flagged instead of scored.</div>
          <div><b>Confidence</b> is not measured psychologically – the app shows observable signals (fillers, long pauses, restarts, hedging).</div>
          <div><b>CEFR level</b> is an informal estimate from in-app activities, not an official certificate.</div>
          <div><b>Free AI tiers</b> have daily limits and may change. The app shows usage and falls back between providers; if both are exhausted, measurement-only feedback still works.</div>
          <div><b>Notifications</b> depend on Android/Vivo battery rules; delivery is not guaranteed.</div>
          <div class="muted">Pictures: Wikimedia Commons (credited on each image). Version 1.0.0.</div>
        </div>
      </div>
    </>
  );
}
