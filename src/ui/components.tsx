import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';
import { go, back } from '../router';

export function Top({ title, backTo, right }: { title: string; backTo?: string | true; right?: ComponentChildren }) {
  return (
    <header class="top">
      {backTo && (
        <button class="icon-btn" aria-label="Back" onClick={() => (backTo === true ? back() : go(backTo))}>
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

export function ScoreRing({ value, size = 88, label, stroke = 8 }: { value?: number; size?: number; label?: string; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0;
  const color = v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--accent)' : v > 0 ? 'var(--warn)' : 'var(--line)';
  return (
    <div class="ring" style={{ width: size, height: size }} role="img" aria-label={`${label || 'Score'} ${typeof value === 'number' ? value : 'not available'}`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-soft)" stroke-width={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} stroke-width={stroke} fill="none" stroke-dasharray={c} stroke-dashoffset={c * (1 - v / 100)} stroke-linecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div class="v num" style={{ fontSize: size * 0.28 }}>
        {typeof value === 'number' ? value : '–'}
        {label && <div class="tiny muted" style={{ fontWeight: 500, fontSize: Math.max(10, size * 0.12) }}>{label}</div>}
      </div>
    </div>
  );
}

export function Bar({ value, tone }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const t = tone || (value >= 75 ? 'good' : value >= 50 ? undefined : 'warn');
  return <div class={`bar ${t || ''}`}><i style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

export function Spark({ values, height = 60, color = 'var(--accent)' }: { values: number[]; height?: number; color?: string }) {
  if (values.length < 2) return <div class="muted small">Not enough data yet.</div>;
  const w = 300;
  const max = Math.max(100, ...values), min = 0;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - ((v - min) / (max - min)) * (height - 6) - 3}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Trend chart">
      <polyline points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity="0.12" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

export function Bars({ data, height = 90, unit = '' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: height + 18 }} role="img" aria-label="Bar chart">
      {data.map((d) => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${d.label}: ${d.value}${unit}`}>
          <div style={{ width: '100%', maxWidth: 22, height: Math.max(2, (d.value / max) * height), background: d.value ? 'var(--accent)' : 'var(--bg-soft)', borderRadius: 5 }} />
          <div class="tiny muted">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label class="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span />
    </label>
  );
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ComponentChildren }) {
  if (!open) return null;
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

let toastSetter: ((m: string) => void) | null = null;
export function toast(m: string) { toastSetter?.(m); }
export function ToastHost() {
  const [msg, setMsg] = useState('');
  const t = useRef<number>();
  useEffect(() => { toastSetter = (m) => { setMsg(m); clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(''), 3200); }; return () => { toastSetter = null; }; }, []);
  return msg ? <div class="toast" role="status">{msg}</div> : null;
}

export function Empty({ icon = 'spark', title, text, action }: { icon?: string; title: string; text?: string; action?: ComponentChildren }) {
  return (
    <div class="card flat center" style={{ padding: 26 }}>
      <div style={{ color: 'var(--accent)', display: 'inline-block' }}><Icon name={icon} size={30} /></div>
      <h3 class="mt">{title}</h3>
      {text && <p class="muted small" style={{ margin: '6px 0 0' }}>{text}</p>}
      {action && <div class="mt">{action}</div>}
    </div>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return <div class="row muted small" style={{ padding: 16, justifyContent: 'center' }}><span class="spinner" /> {text}</div>;
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const needsKey = /API key|AI keys/i.test(error);
  return (
    <div class="notice bad" role="alert">
      {error}
      <div class="row mt" style={{ gap: 8 }}>
        {onRetry && <button class="btn sm ghost" onClick={onRetry}>Try again</button>}
        {needsKey && <button class="btn sm" onClick={() => go('#/settings/keys')}>Add API key</button>}
      </div>
    </div>
  );
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="chips" role="radiogroup">
      {options.map((o) => (
        <button role="radio" aria-checked={o.value === value} class={`chip ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
