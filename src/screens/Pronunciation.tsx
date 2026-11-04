import { useEffect, useState } from 'preact/hooks';
import { Top, Empty } from '../ui/components';
import { Icon } from '../ui/icons';
import { SpeakCapture, type CaptureResult } from '../ui/SpeakCapture';
import { DIFFICULT_WORDS, MINIMAL_PAIRS, READ_ALOUD } from '../data/content/practice';
import { speak } from '../services/speech/tts';
import { alignWords, tokenize } from '../engine/text';
import { computeMetrics } from '../engine/metrics';
import { pronunciationScore } from '../engine/scoring';
import { completeTask, saveSession } from '../services/learning';
import { getProfile, markUsed } from '../services/db';

export function Pronunciation({ setId }: { setId?: string }) {
  if (setId === 'read') return <ReadAloud />;
  if (setId === 'words') return <DifficultWords />;
  const set = MINIMAL_PAIRS.find((m) => m.id === setId);
  if (set) return <PairSet id={set.id} />;
  return (
    <>
      <Top title="Pronunciation" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="notice info small mb">Feedback here is <b>approximate</b>: it checks whether a speech recogniser understood the word you meant. It is not a phoneme-level accent analysis.</div>
        <a class="card tap row" href="#/pronunciation/read" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div class="grow"><b>Read aloud</b><div class="small muted">Read a sentence; see which words were recognised.</div></div><Icon name="chevron" size={18} />
        </a>
        <a class="card tap row mt" href="#/pronunciation/words" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div class="grow"><b>Difficult words</b><div class="small muted">Commonly mispronounced words.</div></div><Icon name="chevron" size={18} />
        </a>
        <h2>Minimal pairs & stress</h2>
        <div class="card">{MINIMAL_PAIRS.map((m) => (
          <a class="list-item" href={`#/pronunciation/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div class="grow"><b>{m.title}</b><div class="tiny muted">{m.pairs.slice(0, 3).map((p) => p.join('/')).join(' · ')}</div></div><Icon name="chevron" size={18} />
          </a>
        ))}</div>
      </div>
    </>
  );
}

function PairSet({ id }: { id: string }) {
  const set = MINIMAL_PAIRS.find((m) => m.id === id)!;
  const [accent, setAccent] = useState('en-US');
  const [target, setTarget] = useState<string | null>(null);
  const [heard, setHeard] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<{ word: string; pair: [string, string] } | null>(null);
  const [qScore, setQScore] = useState({ right: 0, total: 0 });
  const [qPicked, setQPicked] = useState<string | null>(null);
  useEffect(() => { getProfile().then((p) => setAccent(p.accent)); }, []);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

  function nextQuiz() {
    const pair = set.pairs[Math.floor(Math.random() * set.pairs.length)];
    const word = pair[Math.random() < 0.5 ? 0 : 1];
    setQuiz({ word, pair }); setQPicked(null);
    speak(word.replace(/[A-Z]/g, (c) => c.toLowerCase()), { lang: accent, rate: 0.85 });
  }
  async function pick(w: string) {
    if (!quiz || qPicked) return;
    setQPicked(w);
    const s = { right: qScore.right + (w === quiz.word ? 1 : 0), total: qScore.total + 1 };
    setQScore(s);
    if (s.total === 6) {
      await saveSession({ type: 'pronunciation', title: `Minimal pairs: ${set.title}`, startedAt: Date.now() - 120000, endedAt: Date.now(), durationSec: 120, speakingSec: 0, scores: { overall: Math.round((s.right / 6) * 100) }, mistakeCount: 0, report: { set: set.id, quiz: s, heard } });
      await markUsed('pron:' + set.id);
      await completeTask('pronunciation', Math.round((s.right / 6) * 100));
    }
  }
  async function onSaid(r: CaptureResult) {
    if (!target) return;
    setHeard({ ...heard, [target]: r.transcript.text || '(nothing)' });
    setTarget(null);
  }

  return (
    <>
      <Top title={set.title} backTo="#/pronunciation" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card soft small">{set.tip}</div>
        <h2>Listen & repeat</h2>
        <div class="card">
          {set.pairs.map((p) => (
            <div class="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              {p.map((w) => {
                const h = heard[w];
                const ok = h !== undefined && norm(h).includes(norm(w));
                return (
                  <div class="grow">
                    <div class="row" style={{ gap: 4 }}>
                      <button class="btn sm ghost" onClick={() => speak(w.toLowerCase(), { lang: accent, rate: 0.8 })}><Icon name="volume" size={16} /> {w}</button>
                      <button class="icon-btn" aria-label={`Say ${w}`} onClick={() => setTarget(w)}><Icon name="mic" size={18} /></button>
                    </div>
                    {h !== undefined && <div class={`tiny ${ok ? '' : 'muted'}`} style={{ color: ok ? 'var(--good)' : undefined }}>{ok ? '✓ recognised' : `heard: “${h}”`}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {target && (
          <div class="card mt">
            <div class="center">Say: <b style={{ fontSize: 20 }}>{target}</b></div>
            <div class="mt"><SpeakCapture key={target} onSubmit={onSaid} maxSec={6} review={false} allowTyping={false} autoStart /></div>
          </div>
        )}
        <h2>Hearing quiz</h2>
        <div class="card">
          {qScore.total >= 6 ? (
            <Empty icon="ear" title={`You heard ${qScore.right}/6 correctly`} action={<button class="btn" onClick={() => { setQScore({ right: 0, total: 0 }); nextQuiz(); }}>Again</button>} />
          ) : !quiz ? <button class="btn block" onClick={nextQuiz}><Icon name="play" size={18} /> Start (6 rounds)</button> : (
            <>
              <div class="row between small muted"><span>Round {qScore.total + (qPicked ? 0 : 1)} of 6</span><button class="btn sm ghost" onClick={() => speak(quiz.word.toLowerCase(), { lang: accent, rate: 0.85 })}><Icon name="volume" size={16} /> Replay</button></div>
              <div class="grid2 mt">{quiz.pair.map((w) => <button class={`opt ${qPicked && w === quiz.word ? 'right' : ''} ${qPicked === w && w !== quiz.word ? 'wrong' : ''}`} onClick={() => pick(w)}>{w}</button>)}</div>
              {qPicked && qScore.total < 6 && <button class="btn block mt" onClick={nextQuiz}>Next</button>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ReadAloud() {
  const [i, setI] = useState(Math.floor(Math.random() * READ_ALOUD.length));
  const [res, setRes] = useState<{ diff: ReturnType<typeof alignWords>; acc: number; score?: number; heard: string } | null>(null);
  const sentence = READ_ALOUD[i];
  async function onRead(r: CaptureResult) {
    const ref = tokenize(sentence), hyp = tokenize(r.transcript.text);
    const diff = alignWords(ref, hyp);
    const acc = diff.filter((d) => d.status === 'ok').length / ref.length;
    const m = computeMetrics(r.transcript);
    const score = pronunciationScore(m.asrClarity, acc);
    setRes({ diff, acc, score, heard: r.transcript.text });
    await saveSession({ type: 'pronunciation', title: 'Read aloud', startedAt: Date.now() - r.durationSec * 1000, endedAt: Date.now(), durationSec: r.durationSec, speakingSec: m.speakingSec, scores: { overall: score ?? Math.round(acc * 100), pronunciation: score }, metrics: m, mistakeCount: 0, report: { sentence, heard: r.transcript.text, accuracy: acc } });
    await completeTask('pronunciation', score);
  }
  return (
    <>
      <Top title="Read aloud" backTo="#/pronunciation" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card">
          <div style={{ fontSize: 18, lineHeight: 1.5 }}>{sentence}</div>
          <button class="btn sm ghost mt" onClick={() => speak(sentence, { rate: 0.9 })}><Icon name="volume" size={16} /> Listen first</button>
        </div>
        {!res ? (
          <div class="mt"><SpeakCapture key={i} onSubmit={onRead} maxSec={20} review={false} allowTyping={false} /></div>
        ) : (
          <div class="card mt">
            <div class="label">Recognised words (approximate)</div>
            <div class="word-diff mt" style={{ fontSize: 17, lineHeight: 1.7 }}>{res.diff.map((d) => <span class={d.status} title={d.heard ? `heard “${d.heard}”` : 'missed'}>{d.word} </span>)}</div>
            <div class="small mt">Word accuracy: <b>{Math.round(res.acc * 100)}%</b>{typeof res.score === 'number' && <> · Pronunciation (approx.): <b>{res.score}</b></>}</div>
            <div class="tiny muted mt">Heard: “{res.heard}”. Red = recognised as a different word, struck = not heard. Background noise and fast speech also cause errors.</div>
            <div class="row mt"><button class="btn ghost grow" onClick={() => setRes(null)}>Try again</button><button class="btn grow" onClick={() => { setRes(null); setI((i + 1) % READ_ALOUD.length); }}>Next sentence</button></div>
          </div>
        )}
      </div>
    </>
  );
}

function DifficultWords() {
  return (
    <>
      <Top title="Difficult words" backTo="#/pronunciation" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card">{DIFFICULT_WORDS.map((w) => (
          <div class="list-item"><b class="grow">{w}</b>
            <button class="btn sm ghost" onClick={() => speak(w, { lang: 'en-US', rate: 0.8 })}>🇺🇸</button>
            <button class="btn sm ghost" onClick={() => speak(w, { lang: 'en-GB', rate: 0.8 })}>🇬🇧</button>
          </div>
        ))}</div>
      </div>
    </>
  );
}
