import { useEffect, useState } from 'preact/hooks';
import { useRoute, go } from './router';
import { Icon } from './ui/icons';
import { ToastHost } from './ui/components';
import { getProfile, cleanupRecordings, useLive, db } from './services/db';
import { initNotifications, syncNotifications } from './notifications/notify';
import { App as CapApp } from '@capacitor/app';
import { isNative } from './services/platform';
import { Home } from './screens/Home';
import { TeacherModes, Conversation } from './screens/Teacher';
import { Practice } from './screens/Practice';
import { PictureChallenge } from './screens/Picture';
import { Interview } from './screens/Interview';
import { Vocab } from './screens/Vocab';
import { GrammarList, GrammarLesson } from './screens/Grammar';
import { Thinking } from './screens/Thinking';
import { Listening } from './screens/Listening';
import { Pronunciation } from './screens/Pronunciation';
import { Assessment } from './screens/Assessment';
import { Progress, WeeklyReport, History, SessionView, Mistakes } from './screens/Progress';
import { Profile } from './screens/Profile';
import { KeysSettings, NotificationSettings, PrivacySettings, LearningSettings, Diagnostics, About } from './screens/Settings';
import { TimerScreen } from './screens/Timer';
import { Onboarding } from './screens/Onboarding';

export function applyTheme(theme: string) {
  const el = document.documentElement;
  if (theme === 'light' || theme === 'dark') el.setAttribute('data-theme', theme); else el.removeAttribute('data-theme');
}

export function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const profile = useLive(() => getProfile(), []);

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      applyTheme(p.theme);
      if (!p.onboarded && !location.hash.startsWith('#/onboarding')) go('#/onboarding');
      setReady(true);
      cleanupRecordings(14).catch(() => {});
      await initNotifications((r) => go(r));
      if (p.onboarded) syncNotifications().catch(() => {});
    })();
    if (isNative()) {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (location.hash === '#/home' || location.hash === '' ) CapApp.exitApp();
        else if (canGoBack) history.back(); else go('#/home');
      });
    }
  }, []);

  useEffect(() => { if (profile) applyTheme(profile.theme); }, [profile?.theme]);

  if (!ready) return <div class="app" />;
  const [a, b] = route.parts;
  let screen;
  let nav = true;
  switch (a) {
    case 'onboarding': screen = <Onboarding />; nav = false; break;
    case 'teacher': screen = b ? <Conversation mode={b} key={route.query.toString()} /> : <TeacherModes />; nav = !b; break;
    case 'practice': screen = <Practice />; break;
    case 'picture': screen = <PictureChallenge category={b} />; nav = false; break;
    case 'interview': screen = <Interview />; nav = false; break;
    case 'vocab': screen = <Vocab tab={b || 'learn'} />; break;
    case 'grammar': screen = b ? <GrammarLesson id={b} /> : <GrammarList />; break;
    case 'thinking': screen = <Thinking topic={route.query.get('topic') || undefined} />; nav = false; break;
    case 'listening': screen = <Listening theme={route.query.get('theme') || undefined} />; break;
    case 'pronunciation': screen = <Pronunciation setId={b} />; break;
    case 'assessment': screen = <Assessment />; nav = false; break;
    case 'progress': screen = <Progress />; break;
    case 'weekly': screen = <WeeklyReport />; break;
    case 'history': screen = <History />; break;
    case 'session': screen = <SessionView id={Number(b)} />; break;
    case 'mistakes': screen = <Mistakes />; break;
    case 'profile': screen = <Profile />; break;
    case 'notifications': screen = <NotificationSettings />; break;
    case 'settings':
      screen = b === 'keys' ? <KeysSettings /> : b === 'privacy' ? <PrivacySettings /> : b === 'learning' ? <LearningSettings /> : b === 'diagnostics' ? <Diagnostics /> : b === 'about' ? <About /> : <Profile />;
      break;
    case 'timer': screen = <TimerScreen />; break;
    default: screen = <Home />;
  }
  const tab = a === 'teacher' ? 'teacher' : ['practice', 'vocab', 'grammar', 'listening', 'pronunciation'].includes(a) ? 'practice' : ['progress', 'weekly', 'history', 'session', 'mistakes'].includes(a) ? 'progress' : ['profile', 'settings', 'notifications', 'timer'].includes(a) ? 'profile' : 'home';
  return (
    <div class="app">
      {screen}
      {nav && <BottomNav tab={tab} />}
      <ToastHost />
    </div>
  );
}

function BottomNav({ tab }: { tab: string }) {
  const pendingCount = useLive(async () => db.tasks.where('status').equals('pending').count(), []);
  const items = [
    { id: 'home', href: '#/home', icon: 'home', label: 'Home' },
    { id: 'practice', href: '#/practice', icon: 'grid', label: 'Practice' },
    { id: 'teacher', href: '#/teacher', icon: 'mic', label: 'AI Teacher' },
    { id: 'progress', href: '#/progress', icon: 'chart', label: 'Progress' },
    { id: 'profile', href: '#/profile', icon: 'user', label: 'Profile' },
  ];
  return (
    <nav class="nav" aria-label="Main">
      <div class="nav-inner">
        {items.map((i) => (
          <a href={i.href} class={`${tab === i.id ? 'on' : ''} ${i.id === 'teacher' ? 'teach' : ''}`} aria-current={tab === i.id ? 'page' : undefined}>
            {i.id === 'teacher' ? <span class="pill"><Icon name="mic" size={20} /></span> : <Icon name={i.icon} size={22} />}
            <span>{i.label}{i.id === 'home' && pendingCount ? '' : ''}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
