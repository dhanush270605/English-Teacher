import type { Correction, Scores, SpeechMetrics } from '../types';
import { ScoreRing, Bar } from './components';
import { deliveryIndicators } from '../engine/scoring';
import { speak } from '../services/speech/tts';
import { Icon } from './icons';
import { useState } from 'preact/hooks';

const LABELS: Record<string, string> = {
  grammar: 'Grammar', vocabulary: 'Vocabulary', pronunciation: 'Pronunciation*', fluency: 'Fluency', construction: 'Sentence construction', consistency: 'Speaking consistency', relevance: 'Relevance (AI rubric)',
};

export function ScoreGrid({ scores, delta, fluencyPartial }: { scores: Scores; delta?: Partial<Record<keyof Scores, number>>; fluencyPartial?: boolean }) {
  return (
    <div class="card">
      <div class="row" style={{ gap: 16 }}>
        <ScoreRing value={scores.overall} size={96} label="overall" />
        <div class="grow">
          <div class="label">Overall score</div>
          <div class="small muted">Weighted from the measured sub-scores below.</div>
          {delta?.overall !== undefined && (
            <div class={`badge ${delta.overall >= 0 ? 'good' : 'bad'} mt`}>{delta.overall >= 0 ? '▲' : '▼'} {Math.abs(delta.overall)} vs your last sessions</div>
          )}
        </div>
      </div>
      <div class="mt">
        {(Object.keys(LABELS) as (keyof Scores)[]).map((k) => {
          const v = scores[k];
          if (typeof v !== 'number') return null;
          return (
            <div style={{ marginTop: 10 }}>
              <div class="row between small"><span>{LABELS[k]}{k === 'fluency' && fluencyPartial ? ' (partial)' : ''}</span><span class="num"><b>{v}</b>{delta?.[k] !== undefined && <span class="muted"> ({delta[k]! >= 0 ? '+' : ''}{delta[k]})</span>}</span></div>
              <Bar value={v} />
            </div>
          );
        })}
      </div>
      <div class="tiny muted mt">*Pronunciation is approximate: based on how clearly the speech recogniser understood you, not phoneme-level analysis.</div>
    </div>
  );
}

export function CorrectionCard({ c, onPractice }: { c: Correction; onPractice?: () => void }) {
  const [showTamil, setShowTamil] = useState(false);
  return (
    <div class="card fix">
      <div class="k">Original sentence</div>
      <div class="strike">{c.original}</div>
      <div class="k">Corrected sentence</div>
      <div class="ok-text">{c.corrected}</div>
      {c.natural && c.natural !== c.corrected && (<><div class="k">Natural version</div><div class="row"><span class="grow">{c.natural}</span><button class="icon-btn" aria-label="Listen" onClick={() => speak(c.natural)}><Icon name="volume" size={18} /></button></div></>)}
      <div class="k">Why it was wrong</div>
      <div class="small">{c.why} <span class="badge">{c.category}</span></div>
      {c.tamil && (
        <div class="mt small">
          {showTamil ? <div class="card soft small">{c.tamil}</div> : <button class="btn sm ghost" onClick={() => setShowTamil(true)}>Tamil hint</button>}
        </div>
      )}
      {c.practice && (<><div class="k">Practice</div><div class="small">{c.practice}</div></>)}
      {onPractice && <button class="btn sm soft mt" onClick={onPractice}>Practise this</button>}
    </div>
  );
}

export function MetricsPanel({ m }: { m: SpeechMetrics }) {
  const items: [string, string][] = [
    ['Words spoken', String(m.words)],
    ['Speech rate', `${Math.round(m.wpm)} wpm`],
  ];
  if (m.articulationWpm) items.push(['Articulation rate (pauses removed)', `${Math.round(m.articulationWpm)} wpm`]);
  if (m.pauses !== undefined) items.push(['Pauses ≥0.25s', String(m.pauses)]);
  if (m.longPauses !== undefined) items.push(['Long pauses ≥1s', String(m.longPauses)]);
  if (m.meanLengthOfRun !== undefined) items.push(['Words between pauses (avg)', m.meanLengthOfRun.toFixed(1)]);
  items.push(['Filler words', `${m.fillers} (${m.fillersPer100.toFixed(1)}/100 words)`]);
  items.push(['Repeated words / restarts', `${m.immediateRepeats} / ${m.restarts}`]);
  items.push(['Vocabulary diversity', m.words >= 50 ? `MTLD ${m.mtld.toFixed(0)}` : `Root TTR ${m.guiraud.toFixed(1)}`]);
  items.push(['Less-common words', `${Math.round(m.sophistication * 100)}%`]);
  items.push(['Avg sentence length', `${m.avgSentenceLength.toFixed(1)} words`]);
  const fillers = Object.entries(m.fillerBreakdown || {});
  return (
    <div class="card">
      <h3>Speech measurements</h3>
      {!m.timingAvailable && <div class="tiny muted">Pause timing unavailable with this speech engine – fluency is partial.</div>}
      {items.map(([k, v]) => <div class="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><span class="muted">{k}</span><span class="num">{v}</span></div>)}
      {fillers.length > 0 && <div class="mt small">Fillers: {fillers.map(([w, n]) => <span class="badge warn" style={{ marginRight: 6 }}>{w} ×{n}</span>)}</div>}
      {m.overused.length > 0 && <div class="mt small">Overused: {m.overused.map((o) => <span class="badge" style={{ marginRight: 6 }}>{o.word} ×{o.count}</span>)}</div>}
      <div class="mt">
        <div class="label">Delivery indicators (observable, not a confidence test)</div>
        {deliveryIndicators(m).map((d) => <div class="row between small" style={{ padding: '4px 0' }}><span>{d.label}</span><span class={`badge ${d.good ? 'good' : 'warn'}`}>{d.value}</span></div>)}
      </div>
    </div>
  );
}

import { diffWords } from '../engine/text';
import { computeMetrics } from '../engine/metrics';
import type { Transcript } from '../types';

/** Shown right under the learner's own message: full corrected version with mistakes struck out. */
export function InlineFix({ said, fix, corrections, transcript }: { said: string; fix?: { corrected: string; natural?: string }; corrections?: Correction[]; transcript?: Transcript }) {
  const [open, setOpen] = useState(false);
  if (!fix && !corrections?.length) return null;
  const corrected = fix?.corrected?.trim() || '';
  const ops = corrected ? diffWords(said, corrected) : [];
  const changed = ops.some((o) => o.type !== 'same');
  const m = transcript?.words?.length ? computeMetrics(transcript) : undefined;
  return (
    <div class="fixbox">
      {corrected && !changed ? (
        <div class="row small"><span class="badge good">✓ Correct</span><span class="muted">No grammar mistakes.</span></div>
      ) : corrected ? (
        <>
          <div class="k">Correct version</div>
          <div class="diff">{ops.map((o) => <span class={o.type}>{o.text} </span>)}</div>
        </>
      ) : null}
      {fix?.natural && fix.natural.trim() !== corrected && (
        <>
          <div class="k">Say it naturally</div>
          <div class="row" style={{ alignItems: 'flex-start' }}><span class="grow">{fix.natural}</span><button class="icon-btn" aria-label="Listen" onClick={() => speak(fix.natural!)}><Icon name="volume" size={16} /></button></div>
        </>
      )}
      {m && <div class="tiny muted mt">⏱ {Math.round(m.articulationWpm || m.wpm)} words/min · {m.longPauses ?? 0} long pause{m.longPauses === 1 ? '' : 's'} · {m.fillers} filler{m.fillers === 1 ? '' : 's'}</div>}
      {!!corrections?.length && (
        <>
          <button class="linkbtn" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Why?'} ({corrections.length} mistake{corrections.length > 1 ? 's' : ''})</button>
          {open && corrections.map((c) => <div class="tiny" style={{ marginTop: 4 }}><span class="strike">{c.original}</span> → <b>{c.corrected}</b> – {c.why}</div>)}
        </>
      )}
    </div>
  );
}
