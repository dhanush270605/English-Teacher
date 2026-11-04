import { useEffect, useState } from 'preact/hooks';
import { Top, Bar, ErrorBox } from '../ui/components';
import { Icon } from '../ui/icons';
import { GRAMMAR, getTopic } from '../data/content/grammar';
import { db, getProfile, useLive } from '../services/db';
import { completeTask, recordGrammarAttempt } from '../services/learning';
import { analyzeWeaknesses, CATEGORY_TO_TOPIC } from '../engine/recommender';
import { chatJson, friendlyError } from '../services/ai/router';
import { grammarSentenceSystem } from '../services/ai/prompts';
import { speak } from '../services/speech/tts';
import { go } from '../router';

export function GrammarList() {
  const progress = useLive(() => db.grammar.toArray(), []);
  const [weakTopics, setWeak] = useState<Record<string, number>>({});
  useEffect(() => {
    db.mistakes.toArray().then((m) => {
      const w = analyzeWeaknesses([], m);
      const out: Record<string, number> = {};
      for (const g of w.grammar) { const t = CATEGORY_TO_TOPIC[g.category]; out[t] = (out[t] || 0) + g.count; }
      setWeak(out);
    });
  }, []);
  const pm = new Map((progress || []).map((p) => [p.topicId, p]));
  const sorted = [...GRAMMAR].sort((a, b) => (weakTopics[b.id] || 0) - (weakTopics[a.id] || 0));
  return (
    <>
      <Top title="Grammar" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <p class="small muted" style={{ marginTop: 0 }}>Topics with mistakes from your real conversations are shown first. Mastered topics (85%+) are skipped in your daily plan.</p>
        <div class="card">
          {sorted.map((g) => {
            const p = pm.get(g.id);
            return (
              <a class="list-item" href={`#/grammar/${g.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div class="grow">
                  <div class="row"><b>{g.title}</b>{weakTopics[g.id] ? <span class="badge warn">{weakTopics[g.id]} recent mistakes</span> : null}{(p?.mastery || 0) >= 85 && <span class="badge good">mastered</span>}</div>
                  <div class="tiny muted">{g.summary}</div>
                  <div class="mt" style={{ marginTop: 6 }}><Bar value={p?.mastery || 0} /></div>
                </div>
                <span class="small num muted">{p?.mastery ?? 0}%</span>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function GrammarLesson({ id }: { id: string }) {
  const t = getTopic(id);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [tamilOn, setTamilOn] = useState(false);
  const [mastery, setMastery] = useState<number | null>(null);
  const [sentences, setSentences] = useState('');
  const [check, setCheck] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setAnswers(Array(t?.exercises.length || 0).fill(null)); getProfile().then((p) => setTamilOn(p.tamilHelp)); setMastery(null); setCheck(null); }, [id]);
  if (!t) return <><Top title="Grammar" backTo="#/grammar" /><div class="screen">Topic not found.</div></>;
  const answered = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === t.exercises[i].answer).length;

  async function finishExercises() {
    const m = await recordGrammarAttempt(t!.id, answers.map((a, i) => a === t!.exercises[i].answer));
    setMastery(m);
    await completeTask('grammar', Math.round((correct / t!.exercises.length) * 100));
  }

  async function checkSentences() {
    const lines = sentences.split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (!lines.length) return;
    setBusy(true); setErr('');
    try {
      const r = await chatJson<{ results: any[] }>({ purpose: 'grammar-check', system: grammarSentenceSystem(t!.title), messages: [{ role: 'user', content: lines.join('\n') }], tier: 'fast', maxTokens: 500 });
      setCheck(r.results || []);
      await recordGrammarAttempt(t!.id, (r.results || []).map((x: any) => !!x.correct));
    } catch (e) { setErr(friendlyError(e)); }
    setBusy(false);
  }

  return (
    <>
      <Top title={t.title} backTo="#/grammar" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card">
          <div class="label">The rule, simply</div>
          <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>{t.explanation.map((e) => <li style={{ marginBottom: 6 }}>{e}</li>)}</ul>
          {t.tamil && (
            <div class="mt">
              {tamilOn ? <div class="card soft small">{t.tamil}</div> : <button class="btn sm ghost" onClick={() => setTamilOn(true)}>Show Tamil explanation</button>}
            </div>
          )}
        </div>
        <h2>Examples</h2>
        <div class="card">{t.examples.map((e) => (
          <div class="list-item" onClick={() => speak(e.en)}><div class="grow">{e.en}{e.note && <div class="tiny muted">{e.note}</div>}</div><Icon name="volume" size={18} /></div>
        ))}</div>
        <h2>Common mistakes</h2>
        <div class="stack">{t.mistakes.map((m) => (
          <div class="card fix"><div class="strike">{m.wrong}</div><div class="ok-text">{m.right}</div><div class="small muted">{m.why}</div></div>
        ))}</div>
        <h2>Exercises</h2>
        {t.exercises.map((ex, i) => (
          <div class="card mb">
            <b>{i + 1}. {ex.q}</b>
            {ex.options.map((o, k) => (
              <button class={`opt ${answers[i] !== null && k === ex.answer ? 'right' : ''} ${answers[i] === k && k !== ex.answer ? 'wrong' : ''}`} disabled={answers[i] !== null} onClick={() => { const a = [...answers]; a[i] = k; setAnswers(a); }}>{o}</button>
            ))}
            {answers[i] !== null && <div class="small muted mt">{ex.explain}</div>}
          </div>
        ))}
        {answered === t.exercises.length && mastery === null && <button class="btn block" onClick={finishExercises}>See my result ({correct}/{t.exercises.length})</button>}
        {mastery !== null && <div class="notice good">Score {correct}/{t.exercises.length}. Topic mastery is now <b>{mastery}%</b> (from recent answers and your real-conversation mistakes).</div>}
        <h2>Create your own sentences</h2>
        <div class="card">
          <div class="small">{t.produce}</div>
          <textarea class="input mt" maxLength={800} placeholder="One sentence per line…" value={sentences} onInput={(e) => setSentences((e.target as HTMLTextAreaElement).value)} />
          <button class="btn block mt" disabled={busy || !sentences.trim()} onClick={checkSentences}>{busy ? <span class="spinner" /> : 'Check my sentences'}</button>
          {err && <div class="mt"><ErrorBox error={err} onRetry={checkSentences} /></div>}
          {check && check.map((r) => (
            <div class={`notice mt small ${r.correct ? 'good' : 'bad'}`}>{r.correct ? '✓' : '✗'} {r.sentence}{!r.correct && <div><b>{r.fixed}</b></div>}<div class="tiny">{r.why}</div></div>
          ))}
        </div>
        <button class="btn ghost block mt2" onClick={() => go('#/grammar')}>All topics</button>
      </div>
    </>
  );
}

