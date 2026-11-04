import { Top, Loading, Segmented } from '../ui/components';
import { Icon } from '../ui/icons';
import { getProfile, saveProfile, useLive, db } from '../services/db';
import { go } from '../router';

export function Profile() {
  const p = useLive(() => getProfile(), []);
  const sessions = useLive(() => db.sessions.count(), []);
  if (!p) return <><Top title="Profile" /><Loading /></>;
  const links = [
    { href: '#/settings/keys', icon: 'key', title: 'AI keys & usage', text: 'Free Groq / Gemini keys, quotas' },
    { href: '#/notifications', icon: 'bell', title: 'Reminders & notifications', text: 'Times, categories, diagnostics' },
    { href: '#/settings/learning', icon: 'target', title: 'Learning preferences', text: 'Goals, daily time, words, feedback' },
    { href: '#/timer', icon: 'timer', title: 'Practice timer & goals', text: 'Focused sessions' },
    { href: '#/settings/privacy', icon: 'shield', title: 'Privacy & data', text: 'Recordings, export, delete' },
    { href: '#/settings/diagnostics', icon: 'info', title: 'Diagnostics', text: 'Microphone, voices, connectivity' },
    { href: '#/settings/about', icon: 'note', title: 'About & limitations', text: 'How scores work' },
  ];
  return (
    <>
      <Top title="Profile" />
      <div class="screen" style={{ paddingTop: 4 }}>
        <div class="card row" style={{ gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--hero)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700 }}>{(p.name || 'L')[0].toUpperCase()}</div>
          <div class="grow">
            <div style={{ fontWeight: 700, fontSize: 18 }}>{p.name || 'Learner'}</div>
            <div class="small muted">Level {p.level === 'unknown' ? 'not assessed' : `≈ ${p.level}`} · difficulty {p.difficulty}/5 · {sessions ?? 0} sessions</div>
          </div>
        </div>
        {p.level === 'unknown' && <button class="btn soft block mt" onClick={() => go('#/assessment')}><Icon name="target" size={18} /> Take the level assessment</button>}
        <h2>Appearance</h2>
        <Segmented value={p.theme} onChange={(t) => saveProfile({ theme: t })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <h2>Settings</h2>
        <div class="card">{links.map((l) => (
          <a class="list-item" href={l.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div class="task" style={{ padding: 0, border: 'none', background: 'none' }}><div class="ico"><Icon name={l.icon} size={18} /></div></div>
            <div class="grow"><b>{l.title}</b><div class="tiny muted">{l.text}</div></div>
            <Icon name="chevron" size={18} />
          </a>
        ))}</div>
      </div>
    </>
  );
}
