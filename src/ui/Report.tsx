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
