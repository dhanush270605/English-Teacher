import { useEffect, useMemo, useState } from 'preact/hooks';
import type { WordRecord } from '../types';
import { Top, Loading, ErrorBox, Empty, toast } from '../ui/components';
import { Icon } from '../ui/icons';
import { db, getProfile, useLive } from '../services/db';
import { completeTask, ensureWordDetails, todaysNewWords } from '../services/learning';
import { review } from '../engine/srs';
import { speak } from '../services/speech/tts';
import { chatJson, friendlyError } from '../services/ai/router';
import { wordSentenceSystem } from '../services/ai/prompts';
import { IDIOMS } from '../data/content/words';
import { go } from '../router';

const TABS = [{ id: 'learn', label: 'Learn' }, { id: 'review', label: 'Review' }, { id: 'quiz', label: 'Quiz' }, { id: 'words', label: 'My words' }, { id: 'idioms', label: 'Idioms' }];

export function Vocab({ tab }: { tab: string }) {
  return (
    <>
      <Top title="Vocabulary" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="chips mb">{TABS.map((t) => <a class={`chip ${tab === t.id ? 'on' : ''}`} href={`#/vocab/${t.id}`} style={{ textDecoration: 'none' }}>{t.label}</a>)}</div>
        {tab === 'learn' && <Learn />}
        {tab === 'review' && <Review />}
        {tab === 'quiz' && <Quiz />}
        {tab === 'words' && <MyWords />}
        {tab === 'idioms' && <Idioms />}
      </div>
    </>
  );
}

function Learn() {
  const [words, setWords] = useState<WordRecord[] | null>(null);
  const [error, setError] = useState('');
  const [i, setI] = useState(0);
  const [accent, setAccent] = useState('en-US');
  const [tamil, setTamil] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError('');
    try {
      const p = await getProfile();
      setAccent(p.accent); setTamil(p.tamilHelp);
      const w = await todaysNewWords();
      setWords([...w]);
      const withDetails = await ensureWordDetails(w);
      setWords([...withDetails]);
    } catch (e) { setError(friendlyError(e)); }
  }
  useEffect(() => { load(); }, []);

  if (!words) return <Loading text="Preparing today’s words…" />;
  if (!words.length) return <Empty title="You’ve learned every word in the list!" text="Increase the level in your profile or review your words." />;
  const w = words[Math.min(i, words.length - 1)];
  const d = w.details;

  async function markLearned() {
    if (saving) return; // ignore double taps
    setSaving(true);
    const updated = review({ ...w, status: 'learning' }, 4);
    await db.words.put(updated);
    if (i < words!.length - 1) { setI(i + 1); setSaving(false); }
    else { await completeTask('vocab', 100); toast('Today’s words done! They’ll come back for review.'); go('#/vocab/review'); }
  }

  return (
    <div>
      {error && <div class="mb"><ErrorBox error={error} onRetry={load} /></div>}
      <div class="row between small muted mb"><span>Word {i + 1} of {words.length}</span><span class="badge">{w.level}</span></div>
      <div class="card">
        <div class="row" style={{ alignItems: 'flex-start' }}>
          <div class="grow">
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>{w.word}</div>
            <div class="muted small">{d?.ipa} {d?.pos && `· ${d.pos}`}</div>
          </div>
          <button class="icon-btn" aria-label="Pronounce" onClick={() => speak(w.word, { lang: accent, rate: 0.85 })}><Icon name="volume" /></button>
        </div>
        {!d && !error && <Loading text="Getting meaning & examples…" />}
        {d && (
          <div class="stack mt">
            <div><div class="label">Meaning</div>{d.meaning}</div>
            {tamil && d.tamil && <div><div class="label">தமிழ்</div>{d.tamil}</div>}
            <div><div class="label">Example</div><div class="row"><span class="grow">{d.example}</span><button class="icon-btn" aria-label="Listen" onClick={() => speak(d.example, { lang: accent })}><Icon name="volume" size={18} /></button></div></div>
            {d.dailyExample && <div><div class="label">Daily life</div>{d.dailyExample}</div>}
            {!!d.synonyms?.length && <div><div class="label">Synonyms</div><div class="row wrap">{d.synonyms.map((s) => <span class="badge">{s}</span>)}</div></div>}
            {!!d.antonyms?.length && <div><div class="label">Antonyms</div><div class="row wrap">{d.antonyms.map((s) => <span class="badge">{s}</span>)}</div></div>}
            {d.commonMistake && <div class="notice small"><b>Common mistake:</b> {d.commonMistake}</div>}
            {d.conversation && <div><div class="label">In conversation</div><div class="card soft small" style={{ whiteSpace: 'pre-wrap' }}>{d.conversation}</div></div>}
          </div>
        )}
      </div>
      {d && <UseIt word={w} />}
      <div class="row mt">
        <button class="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" size={18} /></button>
        <button class="btn grow" disabled={saving} onClick={markLearned}>{i < words.length - 1 ? 'Got it – next word' : 'Finish today’s words'}</button>
      </div>
    </div>
  );
}

function UseIt({ word }: { word: WordRecord }) {
  const [text, setText] = useState('');
  const [res, setRes] = useState<{ correct: boolean; natural: boolean; fixed: string; why: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setText(''); setRes(null); setErr(''); }, [word.word]);
  async function check() {
    if (!text.toLowerCase().includes(word.word.toLowerCase().slice(0, Math.max(4, word.word.length - 3)))) { setErr(`Use the word “${word.word}” in your sentence.`); return; }
    setBusy(true); setErr('');
    try {
      const r = await chatJson<any>({ purpose: 'vocab-check', system: wordSentenceSystem(word.word), messages: [{ role: 'user', content: text.slice(0, 400) }], tier: 'fast', maxTokens: 200 });
      setRes(r);
      if (!r.correct) await db.words.update(word.word, { misuse: (word.misuse || 0) + 1 });
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  }
  return (
    <div class="card mt">
      <div class="label">Make your own sentence</div>
      <div class="row mt">
        <input class="input grow" maxLength={300} placeholder={`A sentence with “${word.word}”…`} value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button class="btn" disabled={busy || !text.trim()} onClick={check}>{busy ? <span class="spinner" /> : 'Check'}</button>
      </div>
      {err && <div class="small mt" style={{ color: 'var(--bad)' }}>{err}</div>}
      {res && <div class={`notice mt small ${res.correct ? 'good' : 'bad'}`}>{res.correct ? (res.natural ? '✓ Correct and natural!' : '✓ Correct, but could sound more natural:') : '✗ Not quite:'} {(!res.correct || !res.natural) && <b>{res.fixed}</b>}<div class="tiny">{res.why}</div></div>}
    </div>
  );
}

function Review() {
  const due = useLive(async () => (await db.words.where('due').belowOrEqual(Date.now()).toArray()).filter((w) => w.status !== 'new'), []);
  const [queue, setQueue] = useState<WordRecord[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [accent, setAccent] = useState('en-US');
  useEffect(() => { getProfile().then((p) => setAccent(p.accent)); }, []);
  useEffect(() => { if (due && queue === null) setQueue(due.sort(() => Math.random() - 0.5)); }, [due]);
  if (!queue) return <Loading />;
  if (!queue.length) return (
    <Empty icon="check" title={done ? `Reviewed ${done} words 🎉` : 'Nothing due right now'} text="Words come back on a spaced schedule so you remember them long-term." action={<div class="row" style={{ justifyContent: 'center' }}><button class="btn soft" onClick={() => go('#/mistakes')}>Review my mistakes</button><button class="btn ghost" onClick={() => go('#/vocab/quiz')}>Take a quiz</button></div>} />
  );
  const w = queue[0];
  async function rate(q: number) {
    await db.words.put(review(w, q));
    setFlipped(false);
    const rest = q < 3 ? [...queue!.slice(1), w] : queue!.slice(1);
    setQueue(rest);
    setDone(done + 1);
    if (!rest.length) await completeTask('revision', 100);
  }
  return (
    <div>
      <div class="small muted mb">{queue.length} card{queue.length > 1 ? 's' : ''} left</div>
      <div class={`flash ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} role="button" aria-label="Flip card">
        <div class="flash-inner">
          <div class="card flash-face">
            <div style={{ fontSize: 30, fontWeight: 700 }}>{w.word}</div>
            <div class="muted small mt">Do you remember the meaning? Tap to flip.</div>
            <button class="icon-btn mt" aria-label="Pronounce" onClick={(e) => { e.stopPropagation(); speak(w.word, { lang: accent }); }}><Icon name="volume" /></button>
          </div>
          <div class="card flash-face flash-back">
            <div style={{ fontWeight: 700, fontSize: 20 }}>{w.word}</div>
            <div class="mt">{w.details?.meaning || '—'}</div>
            {w.details?.tamil && <div class="muted small mt">{w.details.tamil}</div>}
            {w.details?.example && <div class="small mt" style={{ fontStyle: 'italic' }}>“{w.details.example}”</div>}
          </div>
        </div>
      </div>
      {flipped ? (
        <div class="grid2 mt" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <button class="btn danger sm" onClick={() => rate(1)}>Again</button>
          <button class="btn ghost sm" onClick={() => rate(3)}>Hard</button>
          <button class="btn soft sm" onClick={() => rate(4)}>Good</button>
          <button class="btn sm" onClick={() => rate(5)}>Easy</button>
        </div>
      ) : <button class="btn block mt" onClick={() => setFlipped(true)}>Show answer</button>}
    </div>
  );
}

interface QuizQ { word: string; q: string; options: string[]; answer: number; type: 'meaning' | 'blank' }

export function buildQuiz(words: WordRecord[], n = 6): QuizQ[] {
  const pool = words.filter((w) => w.details?.meaning);
  if (pool.length < 4) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  return shuffled.map((w, i) => {
    const others = pool.filter((o) => o.word !== w.word).sort(() => Math.random() - 0.5).slice(0, 3);
    const ex = w.details!.example || '';
    const re = new RegExp(`\\b${w.word.slice(0, Math.max(3, w.word.length - 2))}[a-z]*\\b`, 'i');
    if (i % 2 === 1 && re.test(ex)) {
      const opts = [w.word, ...others.map((o) => o.word)].sort(() => Math.random() - 0.5);
      return { word: w.word, type: 'blank', q: ex.replace(re, '_____'), options: opts, answer: opts.indexOf(w.word) };
    }
    const opts = [w.details!.meaning, ...others.map((o) => o.details!.meaning)].sort(() => Math.random() - 0.5);
    return { word: w.word, type: 'meaning', q: `What does “${w.word}” mean?`, options: opts, answer: opts.indexOf(w.details!.meaning) };
  });
}

function Quiz() {
  const words = useLive(() => db.words.toArray(), []);
  const [qs, setQs] = useState<QuizQ[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  useEffect(() => { if (words && !qs) setQs(buildQuiz(words)); }, [words]);
  if (!qs) return <Loading />;
  if (!qs.length) return <Empty title="Learn a few words first" text="Quizzes use words you’ve learned (at least 4)." action={<button class="btn" onClick={() => go('#/vocab/learn')}>Learn words</button>} />;
  if (i >= qs.length) return <Empty icon="target" title={`Score: ${score}/${qs.length}`} action={<button class="btn" onClick={() => { setQs(buildQuiz(words!)); setI(0); setScore(0); setPicked(null); }}>New quiz</button>} />;
  const q = qs[i];
  async function pick(k: number) {
    if (picked !== null) return;
    setPicked(k);
    const w = await db.words.get(q.word);
    if (w) await db.words.put({ ...w, correct: w.correct + (k === q.answer ? 1 : 0), wrong: w.wrong + (k === q.answer ? 0 : 1) });
    if (k === q.answer) setScore(score + 1);
  }
  return (
    <div>
      <div class="small muted">Question {i + 1} of {qs.length} · {q.type === 'blank' ? 'Fill in the blank' : 'Meaning'}</div>
      <div class="card mt"><b>{q.q}</b></div>
      {q.options.map((o, k) => <button class={`opt ${picked !== null && k === q.answer ? 'right' : ''} ${picked === k && k !== q.answer ? 'wrong' : ''}`} onClick={() => pick(k)}>{o}</button>)}
      {picked !== null && <button class="btn block mt" onClick={() => { setI(i + 1); setPicked(null); }}>Next</button>}
    </div>
  );
}

function MyWords() {
  const words = useLive(() => db.words.toArray(), []);
  const [f, setF] = useState<'all' | 'learning' | 'known' | 'weak'>('all');
  const list = useMemo(() => (words || []).filter((w) => w.status !== 'new' || w.introducedAt).filter((w) => f === 'all' || (f === 'weak' ? w.wrong > w.correct || w.misuse > 0 : w.status === f)), [words, f]);
  if (!words) return <Loading />;
  const known = words.filter((w) => w.status === 'known').length, learning = words.filter((w) => w.status === 'learning').length;
  return (
    <div>
      <div class="grid3 mb">
        <div class="card center"><div class="big-num num">{learning}</div><div class="tiny muted">learning</div></div>
        <div class="card center"><div class="big-num num">{known}</div><div class="tiny muted">known</div></div>
        <div class="card center"><div class="big-num num">{words.filter((w) => w.wrong > w.correct || w.misuse > 0).length}</div><div class="tiny muted">need work</div></div>
      </div>
      <div class="chips mb">{(['all', 'learning', 'known', 'weak'] as const).map((x) => <button class={`chip ${f === x ? 'on' : ''}`} onClick={() => setF(x)}>{x}</button>)}</div>
      {!list.length ? <Empty title="No words here yet" /> : (
        <div class="card">{list.map((w) => (
          <div class="list-item" onClick={() => speak(w.word)}>
            <div class="grow"><b>{w.word}</b><div class="tiny muted">{w.details?.meaning || '—'}</div></div>
            <span class={`badge ${w.status === 'known' ? 'good' : w.wrong > w.correct ? 'warn' : ''}`}>{w.status}</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function Idioms() {
  return (
    <div class="card">
      {IDIOMS.map((x) => (
        <div class="list-item" onClick={() => speak(x.example)}>
          <div class="grow"><b>{x.phrase}</b><div class="small muted">{x.meaning}</div><div class="small" style={{ fontStyle: 'italic' }}>“{x.example}”</div></div>
          <Icon name="volume" size={18} />
        </div>
      ))}
    </div>
  );
}
