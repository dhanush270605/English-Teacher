// End-to-end tests on the production build in a phone-sized Chromium (Vivo V27 ≈ 412×915 CSS px).
// External services (Groq, Gemini, Wikimedia) are mocked at the network layer so tests are deterministic.
// Microphone uses Chromium's fake capture device fed by tests/e2e/fake-speech.wav.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = path.join(__dirname, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const SAID = 'Yesterday I go to market and I buyed some vegetables. It was very nice and I enjoyed it.';
const state = { transcriptMode: 'clear', chatMode: 'ok', calls: [] };

function words(text, gapAt = {}) {
  let t = 0.2;
  return text.replace(/[.,]/g, '').split(' ').map((w, i) => { const s = t; t += 0.32; const o = { word: w, start: s, end: t }; t += gapAt[i] || 0.06; return o; });
}

function transcription() {
  if (state.transcriptMode === 'unclear') return { text: 'uh market some', duration: 6, words: words('uh market some'), segments: [{ start: 0, end: 6, text: 'uh market some', avg_logprob: -1.6, no_speech_prob: 0.7 }] };
  const w = words(SAID, { 5: 1.3, 10: 0.5 });
  return { text: SAID, duration: w[w.length - 1].end + 0.3, words: w, segments: [{ start: 0, end: w[w.length - 1].end, text: SAID, avg_logprob: -0.12, no_speech_prob: 0.01 }] };
}

function chatReply(system, user) {
  if (/You are Maya/.test(system)) return { reply: 'That sounds lovely! What did you cook with the vegetables?', corrections: [{ original: 'I go to market', corrected: 'I went to the market', natural: 'I went to the market', why: 'Use past simple for yesterday.', category: 'tenses' }, { original: 'I buyed', corrected: 'I bought', natural: 'I picked up', why: '“Buy” is irregular: bought.', category: 'tenses' }, { original: 'invented phrase not said', corrected: 'x', natural: 'x', why: 'should be filtered', category: 'other' }], relevance: 4 };
  if (/English examiner/.test(system)) return { corrections: [{ original: 'I buyed', corrected: 'I bought', natural: 'I bought', why: 'Irregular past tense.', category: 'tenses', practice: 'Say 3 sentences with bought.' }], relevance: 3, strengths: ['Clear ideas'], betterExpressions: [{ instead: 'very nice', try: 'really pleasant' }], summary: 'Good description with one tense error.', modelAnswer: 'In this picture, people are shopping at a busy market…', descriptionQuality: 3 };
  if (/vocabulary teacher/.test(system)) {
    const list = (user.match(/Words: (.*)/) || [, ''])[1].split(',').map((s) => s.trim()).filter(Boolean);
    return { words: list.map((w) => ({ word: w, pos: 'verb', ipa: '/test/', meaning: `meaning of ${w}`, tamil: 'தமிழ் பொருள்', example: `I will ${w} it tomorrow.`, dailyExample: `Daily ${w}.`, synonyms: ['a'], antonyms: [], commonMistake: 'Mistake.', conversation: 'A: Hi\nB: Hello' })) };
  }
  if (/Evaluate whether the learner used the word/.test(system)) return { correct: true, natural: true, fixed: user, why: 'Good.' };
  if (/listening practice/.test(system)) return { title: 'Cafe', lines: [{ speaker: 'A', name: 'Ravi', text: 'Hi, one coffee please.' }, { speaker: 'B', name: 'Ana', text: 'Sure, anything else?' }], questions: [{ q: 'What does Ravi order?', options: ['Tea', 'Coffee', 'Juice', 'Water'], answer: 1 }, { q: 'Who serves?', options: ['Ana', 'Ravi', 'Tom', 'Raj'], answer: 0 }] };
  if (/professional interviewer/.test(system)) return { evaluation: { grammar: 3, clarity: 3, relevance: 4, structure: 2, completeness: 3, professional: 3, star: { situation: false, task: false, action: false, result: false }, feedback: 'Clear but add structure.', improvedAnswer: 'Yesterday I went to the market and bought vegetables.' }, corrections: [{ original: 'I buyed', corrected: 'I bought', natural: 'I bought', why: 'Irregular verb.', category: 'tenses' }], nextQuestion: 'Why should we hire you?' };
  if (/interview performance report/.test(system)) return { weaknesses: ['Answer structure'], strengths: ['Relevance'], exercises: ['Practise STAR'], nextInterview: 'Behavioural, intermediate.' };
  if (/check sentences/.test(system)) return { results: [{ sentence: 'I went home.', correct: true, fixed: 'I went home.', why: 'Correct.' }] };
  if (/weekly report/.test(system)) return { improved: 'Fluency improved.', remaining: 'Tenses.', grammarToRevise: ['tenses'], wordsToPractice: ['adapt'], fluencyChange: 'Fewer pauses.', nextWeekFocus: ['A', 'B', 'C'] };
  if (/Summarise/.test(system)) return null;
  return { reply: 'ok', corrections: [] };
}

async function setupRoutes(context) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  await context.route('https://api.groq.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = req.url();
    state.calls.push(url);
    if (url.includes('/audio/transcriptions')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(transcription()) });
    if (url.endsWith('/models')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ data: [{ id: 'openai/gpt-oss-20b' }, { id: 'openai/gpt-oss-120b' }, { id: 'whisper-large-v3-turbo' }] }) });
    if (state.chatMode === '429') return route.fulfill({ status: 429, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { message: 'Rate limit reached: requests per day' } }) });
    const body = JSON.parse(req.postData() || '{}');
    const sys = body.messages?.[0]?.content || '';
    const user = body.messages?.[body.messages.length - 1]?.content || '';
    const r = chatReply(sys, user);
    const content = r === null ? 'Learner practised daily life talk; tense errors.' : JSON.stringify(r);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }) });
  });
  await context.route('https://generativelanguage.googleapis.com/**', (route) => route.fulfill({ status: 401, headers: cors, body: '{}' }));
  await context.route('https://commons.wikimedia.org/**', (route) => route.fulfill({
    status: 200, headers: { ...cors, 'content-type': 'application/json' },
    body: JSON.stringify({ query: { pages: { 1: { title: 'File:Busy market.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/x/market.jpg', thumburl: 'https://upload.wikimedia.org/x/900px-market.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Busy_market.jpg', width: 1200, extmetadata: { ImageDescription: { value: 'A busy vegetable market' }, Artist: { value: 'Test Author' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } }),
  }));
  const png = fs.readFileSync(path.join(ROOT, 'public/icons/icon-512.png'));
  await context.route('https://upload.wikimedia.org/**', (route) => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: png }));
}

const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  ✓ ${name}`); }
  catch (e) { results.push({ name, ok: false, err: e.message.split('\n')[0] }); console.log(`  ✗ ${name}\n      ${e.message.split('\n').slice(0, 3).join('\n      ')}`); }
}
const expectVisible = async (page, sel, timeout = 8000) => page.locator(sel).first().waitFor({ state: 'visible', timeout });

async function record(page, ms = 2500) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(ms);
  await page.getByRole('button', { name: 'Stop recording' }).click();
}

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.join(__dirname, 'fake-speech.wav')}`, '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ['microphone'], acceptDownloads: true });
  await setupRoutes(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|401/.test(m.text())) errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: false });

  console.log('E2E (mobile 412×915):');

  await test('onboarding → home with daily plan', async () => {
    await page.goto(BASE);
    await expectVisible(page, 'text=Your personal English coach');
    await shot('01-onboarding');
    await page.fill('input[placeholder="Your name"]', 'Dhanush');
    await page.click('text=Continue');
    await page.click('text=Crack interviews');
    await page.click('text=Continue');
    await page.fill('input[aria-label="Groq key"]', 'gsk_' + 'a'.repeat(48));
    await page.click('text=Continue');
    await page.click('text=Start learning now');
    await expectVisible(page, 'text=Today’s plan');
    await expectVisible(page, 'text=Dhanush');
    const n = await page.locator('.task').count();
    if (n < 8) throw new Error(`expected ≥8 tasks, got ${n}`);
    await shot('02-home');
  });

  await test('bottom navigation works for all tabs', async () => {
    for (const [label, text] of [['Practice', 'Picture speaking'], ['Progress', 'Your progress appears here'], ['Profile', 'AI keys & usage'], ['AI Teacher', 'Choose a mode'], ['Home', 'Today’s plan']]) {
      await page.locator('nav.nav a', { hasText: label }).click();
      await expectVisible(page, `text=${text}`);
    }
  });

  await test('theme switching (dark/light)', async () => {
    await page.goto(BASE + '#/profile');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page.waitForTimeout(200);
    if ((await page.getAttribute('html', 'data-theme')) !== 'dark') throw new Error('dark not applied');
    await page.goto(BASE + '#/home');
    await page.waitForTimeout(300);
    await shot('03-home-dark');
    await page.goto(BASE + '#/profile');
    await page.getByRole('radio', { name: 'Light' }).click();
    await page.waitForTimeout(200);
    if ((await page.getAttribute('html', 'data-theme')) !== 'light') throw new Error('light not applied');
  });

  await test('no horizontal overflow on main screens', async () => {
    for (const r of ['#/home', '#/practice', '#/teacher', '#/progress', '#/profile', '#/grammar', '#/vocab/learn', '#/notifications', '#/settings/keys']) {
      await page.goto(BASE + r);
      await page.waitForTimeout(400);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w > 412) throw new Error(`${r} overflows: ${w}px`);
    }
  });

  await test('AI teacher: record → transcript review → AI reply → session report', async () => {
    await page.goto(BASE + '#/teacher/daily');
    await expectVisible(page, '.bubble.ai');
    await record(page);
    await expectVisible(page, 'text=What I heard');
    const val = await page.inputValue('textarea[aria-label^="Recognised text"]');
    if (!val.includes('buyed')) throw new Error('transcript not shown: ' + val);
    await shot('04-review');
    await page.getByRole('button', { name: 'Send' }).click();
    await expectVisible(page, 'text=What did you cook');
    await shot('05-conversation');
    await page.click('text=End & get feedback');
    await expectVisible(page, 'text=Session report');
    await expectVisible(page, 'text=I went to the market');
    const fixes = await page.locator('.fix').count();
    if (fixes !== 2) throw new Error(`expected 2 verified corrections (hallucinated one filtered), got ${fixes}`);
    await expectVisible(page, 'text=Long pauses ≥1s');
    await shot('06-report');
  });

  await test('low-confidence transcription asks to check/repeat', async () => {
    state.transcriptMode = 'unclear';
    await page.goto(BASE + '#/teacher/friendly?n=2');
    await expectVisible(page, '.bubble.ai');
    await record(page, 2000);
    await expectVisible(page, 'text=Parts of the recording were unclear');
    await expectVisible(page, 'text=Re-record');
    state.transcriptMode = 'clear';
  });

  await test('offline: clear message, no crash', async () => {
    await page.goto(BASE + '#/teacher/college?n=4');
    await expectVisible(page, '.bubble.ai');
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Type instead' }).click();
    await page.fill('textarea[aria-label="Type your answer"]', 'I like computer science.');
    await page.getByRole('button', { name: 'Send' }).click();
    await expectVisible(page, 'text=You are offline');
    await context.setOffline(false);
  });

  await test('picture challenge: image → speak → report with model answer', async () => {
    await page.goto(BASE + '#/picture');
    await page.click('text=Show me a picture');
    await expectVisible(page, 'img.pic');
    await page.click('text=Start now');
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await expectVisible(page, 'text=What I heard');
    await page.getByRole('button', { name: 'Send' }).click();
    await expectVisible(page, 'text=Model answer', 15000);
    await expectVisible(page, 'text=really pleasant');
    await shot('07-picture-report');
  });

  await test('vocabulary: AI word cards → learn all → review', async () => {
    await page.goto(BASE + '#/vocab/learn');
    await expectVisible(page, 'text=Meaning');
    await expectVisible(page, 'text=தமிழ்');
    await shot('08-vocab');
    await page.fill('input[placeholder^="A sentence with"]', 'x');
    const word = (await page.locator('.card >> nth=0').innerText()).split('\n')[0];
    await page.fill('input[placeholder^="A sentence with"]', `I want to ${word} this.`);
    await page.click('text=Check');
    await expectVisible(page, 'text=Correct and natural');
    for (let i = 0; i < 10; i++) {
      const btn = page.locator('button', { hasText: /Got it – next word|Finish today’s words/ });
      if (!(await btn.count())) { await shot('dbg-vocab-' + i); }
      const txt = await btn.innerText();
      try { await btn.click({ timeout: 5000 }); } catch (e) { await shot('dbg-vocab-click-' + i); throw new Error('click failed at ' + i + ' ' + txt + ' ' + e.message.split('\n').slice(0,8).join(' ')); }
      if (txt.includes('Finish')) break;
      await page.locator(`text=Word ${i + 2} of`).waitFor({ timeout: 4000 });
    }
    await expectVisible(page, 'text=/Nothing due right now|cards? left/');
  });

  await test('grammar lesson: exercises → mastery', async () => {
    await page.goto(BASE + '#/grammar/articles');
    await expectVisible(page, 'text=The rule, simply');
    const cards = page.locator('.card:has(.opt)');
    const n = await cards.count();
    for (let i = 0; i < n; i++) await cards.nth(i).locator('.opt').first().click();
    await page.click('text=/See my result/');
    await expectVisible(page, 'text=/Topic mastery is now/');
  });

  await test('interview: question → voice answer → report', async () => {
    await page.goto(BASE + '#/interview');
    await page.click('text=Start mock interview');
    await expectVisible(page, 'text=Interviewer');
    await record(page, 2200);
    await page.getByRole('button', { name: 'Send' }).click();
    await expectVisible(page, 'text=Why should we hire you?', 10000);
    await page.click('text=End interview now');
    await expectVisible(page, 'text=Interview report', 10000);
    await expectVisible(page, 'text=Improved answer');
    await shot('09-interview-report');
  });

  await test('listening: dialogue + questions + transcript', async () => {
    await page.goto(BASE + '#/listening');
    await page.click('text=Create dialogue');
    await expectVisible(page, 'text=What does Ravi order?');
    await page.click('text=Coffee');
    await page.locator('.card:has-text("Who serves?") .opt', { hasText: 'Ana' }).click();
    await page.click('text=Finish & see transcript');
    await expectVisible(page, 'text=Score: 2/2');
  });

  await test('assessment: grammar quiz part saves progress', async () => {
    await page.goto(BASE + '#/assessment');
    await page.click('text=Grammar quiz');
    for (let i = 0; i < 15; i++) await page.locator('.opt').first().click();
    await expectVisible(page, 'text=/1\\/5 done/');
  });

  await test('progress dashboard shows real session data', async () => {
    await page.goto(BASE + '#/progress');
    await expectVisible(page, 'text=Overall speaking score');
    await expectVisible(page, 'text=tenses');
    await shot('10-progress');
    await page.click('text=Weekly report');
    await page.click('text=Write my weekly summary (AI)');
    await expectVisible(page, 'text=Fewer pauses.');
  });

  await test('mistake dictionary: mark as fixed', async () => {
    await page.goto(BASE + '#/mistakes');
    await expectVisible(page, '.fix');
    const before = await page.locator('.fix').count();
    await page.locator('button', { hasText: 'Mark as fixed' }).first().click();
    await page.waitForTimeout(300);
    const after = await page.locator('.fix').count();
    if (after !== before - 1) throw new Error(`${before} → ${after}`);
  });

  await test('settings: keys test, notifications (browser notice), export, delete recordings', async () => {
    await page.goto(BASE + '#/settings/keys');
    await page.click('text=Test & load models');
    await expectVisible(page, 'text=/key works/');
    await expectVisible(page, 'text=Today’s usage');
    await page.goto(BASE + '#/notifications');
    await expectVisible(page, 'text=need the Android app');
    await shot('11-notifications');
    await page.goto(BASE + '#/settings/privacy');
    const dl = page.waitForEvent('download');
    await page.click('text=Export learning history');
    const d = await dl;
    const p = await d.path();
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(json.sessions) || json.sessions.length < 3) throw new Error('export missing sessions');
    if (JSON.stringify(json).includes('gsk_aaaa')) throw new Error('API key leaked into export!');
    await page.click('text=/Delete all recordings/');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expectVisible(page, 'text=Delete all recordings (0)');
  });

  await test('rate-limit (429) shows graceful error with retry', async () => {
    state.chatMode = '429';
    await page.goto(BASE + '#/teacher/travel?n=3');
    await expectVisible(page, '.bubble.ai');
    await page.getByRole('button', { name: 'Type instead' }).click();
    await page.fill('textarea[aria-label="Type your answer"]', 'I want to book a room for two nights.');
    await page.getByRole('button', { name: 'Send' }).click();
    await expectVisible(page, 'text=/quota|Rate limit/i');
    await expectVisible(page, 'text=Try again');
    state.chatMode = 'ok';
  });

  await test('timer: start, pause, resume, finish', async () => {
    await page.goto(BASE + '#/timer');
    await page.click('text=/Start 10-minute session/');
    await page.waitForTimeout(1200);
    await page.click('text=Pause');
    await page.click('text=Resume');
    await page.getByRole('button', { name: 'Finish' }).click();
    await expectVisible(page, 'text=Session complete');
  });

  await test('microphone permission denied shows guidance', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 }, permissions: [] });
    await setupRoutes(ctx2);
    const p2 = await ctx2.newPage();
    await p2.goto(BASE);
    // Reuse onboarding quickly
    await p2.fill('input[placeholder="Your name"]', 'T'); await p2.click('text=Continue'); await p2.click('text=Continue');
    await p2.fill('input[aria-label="Groq key"]', 'gsk_' + 'b'.repeat(48)); await p2.click('text=Continue'); await p2.click('text=Start learning now');
    await p2.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })); });
    await p2.locator('text=Today’s plan').waitFor();
    await p2.waitForTimeout(500);
    await p2.goto(BASE + '#/teacher/daily');
    await p2.waitForTimeout(1500);
    await p2.screenshot({ path: path.join(SHOTS, 'dbg-mic.png') });
    await p2.getByRole('button', { name: 'Start recording' }).click();
    await p2.locator('text=Microphone permission is off').waitFor({ timeout: 5000 });
    await ctx2.close();
  });

  await test('no uncaught runtime errors', async () => {
    const real = errors.filter((e) => !/net::ERR|offline|Failed to fetch|NetworkError|AbortError/i.test(e));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  await browser.close();
  server.kill();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(__dirname, 'e2e-results.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})();
