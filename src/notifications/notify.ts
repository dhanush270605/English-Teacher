// Local notification scheduling (Android). Uses AlarmManager via @capacitor/local-notifications,
// which re-schedules after reboot (BOOT_COMPLETED receiver ships with the plugin).
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { db, getKV, setKV } from '../services/db';
import { isNative } from '../services/platform';

export interface NotifCategory {
  id: string;
  label: string;
  channel: 'practice' | 'vocab' | 'reports' | 'streak';
  times: string[]; // HH:MM
  title: string;
  body: string;
  route: string;
  enabled: boolean;
  weekday?: number; // 1=Sunday … 7=Saturday (Capacitor Weekday) for weekly items
}

export const DEFAULT_CATEGORIES: NotifCategory[] = [
  { id: 'daily', label: 'Daily practice', channel: 'practice', times: ['07:00'], title: 'Good morning! ☀️', body: 'Your English plan for today is ready.', route: '#/home', enabled: true },
  { id: 'vocab', label: 'Word of the day', channel: 'vocab', times: ['07:15'], title: 'Word of the day', body: 'Learn today’s words in 3 minutes.', route: '#/vocab/learn', enabled: true },
  { id: 'grammar', label: 'Grammar challenge', channel: 'practice', times: ['07:30'], title: 'Grammar challenge', body: 'One topic, five quick questions.', route: '#/grammar', enabled: true },
  { id: 'speaking', label: 'Speaking practice', channel: 'practice', times: ['13:00'], title: 'Time to speak 🎙️', body: 'A 5-minute conversation keeps fluency growing.', route: '#/teacher', enabled: true },
  { id: 'picture', label: 'Picture challenges', channel: 'practice', times: ['14:00'], title: 'Picture challenge', body: 'Describe today’s picture for 60 seconds.', route: '#/picture', enabled: true },
  { id: 'conversation', label: 'Conversation practice', channel: 'practice', times: ['18:00'], title: 'Evening conversation', body: 'Chat with Maya about your day.', route: '#/teacher/daily', enabled: true },
  { id: 'interview', label: 'Interview preparation', channel: 'practice', times: ['19:00'], title: 'Interview practice', body: 'Answer 3 interview questions out loud.', route: '#/interview', enabled: true },
  { id: 'listening', label: 'Listening', channel: 'practice', times: [], title: 'Listening practice', body: 'A short dialogue and 4 questions.', route: '#/listening', enabled: false },
  { id: 'revision', label: 'Vocabulary revision', channel: 'vocab', times: ['20:30'], title: 'Revision time', body: 'Review your due flashcards.', route: '#/vocab/review', enabled: true },
  { id: 'summary', label: 'Daily summary', channel: 'reports', times: ['21:00'], title: 'Today’s summary', body: 'See what you practised and what to fix.', route: '#/progress', enabled: true },
  { id: 'preview', label: 'Tomorrow’s preview', channel: 'reports', times: ['21:15'], title: 'Tomorrow’s plan', body: 'Peek at tomorrow’s lessons.', route: '#/home', enabled: true },
  { id: 'streak', label: 'Practice streak / unfinished goals', channel: 'streak', times: ['20:00'], title: 'Don’t lose your streak 🔥', body: 'You still have tasks left today.', route: '#/home', enabled: true },
  { id: 'weekly', label: 'Weekly assessment', channel: 'reports', times: ['10:00'], weekday: 1, title: 'Weekly assessment', body: 'Measure your progress (15 minutes).', route: '#/assessment', enabled: true },
  { id: 'milestones', label: 'Learning milestones', channel: 'reports', times: [], title: 'Milestone', body: '', route: '#/progress', enabled: true },
];

export async function getCategories(): Promise<NotifCategory[]> {
  const saved = await getKV<Partial<NotifCategory>[]>('notifCategories', []);
  return DEFAULT_CATEGORIES.map((d) => ({ ...d, ...(saved.find((s) => s.id === d.id) || {}) }));
}
export async function saveCategories(cats: NotifCategory[]) {
  await setKV('notifCategories', cats.map(({ id, times, enabled }) => ({ id, times, enabled })));
}

/** Deterministic ids: category index × 10 + slot. One-off ids start at 5000. */
export function buildSchedule(cats: NotifCategory[]): LocalNotificationSchema[] {
  const out: LocalNotificationSchema[] = [];
  cats.forEach((c, ci) => {
    if (!c.enabled || c.id === 'streak' || c.id === 'milestones') return; // streak is one-off (cancellable when goals are done)
    c.times.forEach((t, si) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(t);
      if (!m) return;
      const hour = +m[1], minute = +m[2];
      if (hour > 23 || minute > 59) return;
      out.push({
        id: 100 + ci * 10 + si,
        title: c.title,
        body: c.body,
        channelId: c.channel,
        actionTypeId: 'learn',
        extra: { route: c.route, category: c.id },
        schedule: { on: c.weekday ? { weekday: c.weekday as any, hour, minute } : { hour, minute }, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon',
      });
    });
  });
  return out;
}

/** Streak / unfinished-goal reminders for the next 3 days, skipped for days whose goals are already done. */
export function buildStreakOneOffs(cat: NotifCategory | undefined, doneToday: boolean, now = new Date()): LocalNotificationSchema[] {
  if (!cat?.enabled || !cat.times[0]) return [];
  const [h, m] = cat.times[0].split(':').map(Number);
  const out: LocalNotificationSchema[] = [];
  for (let d = 0; d < 3; d++) {
    const at = new Date(now);
    at.setDate(at.getDate() + d);
    at.setHours(h, m, 0, 0);
    if (at.getTime() <= now.getTime() + 60000) continue;
    if (d === 0 && doneToday) continue;
    out.push({ id: 5000 + d, title: cat.title, body: cat.body, channelId: 'streak', actionTypeId: 'learn', extra: { route: cat.route, category: 'streak' }, schedule: { at, allowWhileIdle: true }, smallIcon: 'ic_stat_icon' });
  }
  return out;
}

let listenersReady = false;

export async function initNotifications(navigate: (route: string) => void) {
  if (!isNative() || listenersReady) return;
  listenersReady = true;
  try {
    await LocalNotifications.registerActionTypes({
      types: [{ id: 'learn', actions: [{ id: 'start', title: 'Start now', foreground: true }, { id: 'snooze', title: 'Snooze 15 min', foreground: false }] }],
    });
    for (const ch of [
      { id: 'practice', name: 'Practice reminders', importance: 4 },
      { id: 'vocab', name: 'Vocabulary', importance: 3 },
      { id: 'reports', name: 'Summaries & reports', importance: 3 },
      { id: 'streak', name: 'Streak & unfinished goals', importance: 4 },
    ]) await LocalNotifications.createChannel({ ...ch, description: ch.name, visibility: 1, vibration: true } as any);
  } catch (e) { console.warn('notif init', (e as any)?.message); }
  LocalNotifications.addListener('localNotificationActionPerformed', async (a) => {
    const n = a.notification;
    const cat = n.extra?.category || 'unknown';
    if (a.actionId === 'snooze') {
      await LocalNotifications.schedule({ notifications: [{ ...n, id: 6000 + Math.floor(Math.random() * 900), schedule: { at: new Date(Date.now() + 15 * 60000), allowWhileIdle: true } } as any] });
      await db.notifLog.add({ ts: Date.now(), category: cat, event: 'snoozed' });
      return;
    }
    await db.notifLog.add({ ts: Date.now(), category: cat, event: 'opened' });
    if (n.extra?.route) navigate(n.extra.route);
  });
  LocalNotifications.addListener('localNotificationReceived', (n) => {
    db.notifLog.add({ ts: Date.now(), category: n.extra?.category || 'unknown', event: 'shown (app open)' });
  });
}

export interface NotifStatus { supported: boolean; permission: string; exact?: string; pending: number }

export async function notificationStatus(): Promise<NotifStatus> {
  if (!isNative()) {
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    return { supported: false, permission: perm, pending: 0 };
  }
  const p = await LocalNotifications.checkPermissions();
  let exact: string | undefined;
  try { exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; } catch { /* older Android */ }
  const pending = (await LocalNotifications.getPending()).notifications.length;
  return { supported: true, permission: p.display, exact, pending };
}

export async function requestNotificationPermission(): Promise<string> {
  if (!isNative()) {
    if (typeof Notification === 'undefined') return 'unsupported';
    return await Notification.requestPermission();
  }
  return (await LocalNotifications.requestPermissions()).display;
}

export async function openExactAlarmSettings() {
  if (isNative()) { try { await LocalNotifications.changeExactNotificationSetting(); } catch { /* ignore */ } }
}

/** Rebuilds all scheduled notifications from settings. Safe to call often. */
export async function syncNotifications(doneToday = false): Promise<{ scheduled: number; note?: string }> {
  if (!isNative()) return { scheduled: 0, note: 'Scheduled notifications need the Android app. In the browser, reminders show inside the app.' };
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return { scheduled: 0, note: 'Notification permission not granted.' };
  const cats = await getCategories();
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= 100 && n.id < 6000);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  const list = [...buildSchedule(cats), ...buildStreakOneOffs(cats.find((c) => c.id === 'streak'), doneToday)];
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return { scheduled: list.length };
}

export async function testNotification(seconds = 10) {
  if (!isNative()) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setTimeout(() => new Notification('English Mastery', { body: 'Test notification (browser, app must stay open).' }), seconds * 1000);
      return 'Browser test scheduled (keep this tab open).';
    }
    return 'Allow notifications first.';
  }
  await LocalNotifications.schedule({ notifications: [{ id: 6999, title: 'Test reminder ✅', body: 'Notifications are working. Tap to open.', channelId: 'practice', actionTypeId: 'learn', extra: { route: '#/notifications', category: 'test' }, schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true }, smallIcon: 'ic_stat_icon' }] });
  return `Test notification scheduled in ${seconds}s. Lock the phone or close the app to check background delivery.`;
}

export async function milestone(title: string, body: string) {
  const cats = await getCategories();
  if (!cats.find((c) => c.id === 'milestones')?.enabled || !isNative()) return;
  await LocalNotifications.schedule({ notifications: [{ id: 7000 + Math.floor(Math.random() * 900), title, body, channelId: 'reports', schedule: { at: new Date(Date.now() + 1500) }, extra: { route: '#/progress', category: 'milestones' }, smallIcon: 'ic_stat_icon' }] });
}
