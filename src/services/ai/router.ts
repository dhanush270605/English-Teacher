// Provider router: ordered fallback, local rate limiting, daily caps, cooldown on quota errors, usage monitoring.
import { db, getKV } from '../db';
import { getSecret, isOnline } from '../platform';
import { dateKey } from '../../engine/scheduler';
import { geminiProvider, groqProvider } from './providers';
import { AIError, DEFAULT_AI_CONFIG, type AIConfig, type ChatRequest, type ChatResult, type LLMProvider, type ProviderId } from './types';

const providers: Record<ProviderId, LLMProvider> = { groq: groqProvider, gemini: geminiProvider };
const cooldownUntil: Partial<Record<ProviderId, number>> = {};
const recentCalls: Record<ProviderId, number[]> = { groq: [], gemini: [] };

export async function getAIConfig(): Promise<AIConfig> {
  const c = await getKV<Partial<AIConfig>>('aiConfig', {});
  return { ...DEFAULT_AI_CONFIG, ...c, dailyCap: { ...DEFAULT_AI_CONFIG.dailyCap, ...(c.dailyCap || {}) }, rpm: { ...DEFAULT_AI_CONFIG.rpm, ...(c.rpm || {}) } };
}

export async function recordUsage(provider: string, delta: { requests?: number; tokensIn?: number; tokensOut?: number; audioSec?: number; errors?: number }) {
  const date = dateKey();
  const id = `${date}|${provider}`;
  await db.transaction('rw', db.usage, async () => {
    const r = (await db.usage.get(id)) || { id, date, provider, requests: 0, tokensIn: 0, tokensOut: 0, audioSec: 0, errors: 0 };
    r.requests += delta.requests || 0;
    r.tokensIn += delta.tokensIn || 0;
    r.tokensOut += delta.tokensOut || 0;
    r.audioSec += delta.audioSec || 0;
    r.errors += delta.errors || 0;
    await db.usage.put(r);
  });
}

async function todayRequests(p: string): Promise<number> {
  return (await db.usage.get(`${dateKey()}|${p}`))?.requests || 0;
}

function rpmOk(p: ProviderId, limit: number, now = Date.now()) {
  recentCalls[p] = recentCalls[p].filter((t) => now - t < 60000);
  return recentCalls[p].length < limit;
}

export async function availableProviders(): Promise<ProviderId[]> {
  const cfg = await getAIConfig();
  const out: ProviderId[] = [];
  for (const p of cfg.order) if (await getSecret(p === 'groq' ? 'groqKey' : 'geminiKey')) out.push(p);
  return out;
}

export interface RouterDeps {
  getKey: (p: ProviderId) => Promise<string>;
  providers: Record<ProviderId, LLMProvider>;
  config: () => Promise<AIConfig>;
  online: () => boolean;
}

const defaultDeps: RouterDeps = {
  getKey: (p) => getSecret(p === 'groq' ? 'groqKey' : 'geminiKey'),
  providers,
  config: getAIConfig,
  online: isOnline,
};

export async function chat(req: ChatRequest, deps: RouterDeps = defaultDeps): Promise<ChatResult> {
  if (!deps.online()) throw new AIError('offline', 'You are offline. AI feedback needs internet; your practice is saved and can be analysed later.');
  const cfg = await deps.config();
  const order = req.image ? (['gemini'] as ProviderId[]) : req.search ? (['gemini', 'groq'] as ProviderId[]) : cfg.order;
  let lastErr: AIError | undefined;
  const errs: AIError[] = [];
  let tried = 0;
  for (const p of order) {
    const key = await deps.getKey(p);
    if (!key) continue;
    const now = Date.now();
    if ((cooldownUntil[p] || 0) > now) { lastErr = new AIError('quota', `${p} is cooling down after a rate limit.`, cooldownUntil[p]! - now, p); continue; }
    if (!rpmOk(p, cfg.rpm[p])) { lastErr = new AIError('quota', `Local per-minute limit for ${p} reached.`, 15000, p); continue; }
    if ((await todayRequests(p)) >= cfg.dailyCap[p]) { lastErr = new AIError('quota', `Daily safety cap for ${p} reached (${cfg.dailyCap[p]}). Change it in Settings.`, undefined, p); continue; }
    tried++;
    recentCalls[p].push(now);
    try {
      const res = await deps.providers[p].chat({ ...req, messages: trimMessages(req.messages) }, key, cfg);
      await recordUsage(p, { requests: 1, tokensIn: res.tokensIn, tokensOut: res.tokensOut });
      return res;
    } catch (e) {
      const err = e instanceof AIError ? e : new AIError('network', String((e as any)?.message || e), 10000, p);
      await recordUsage(p, { requests: 1, errors: 1 });
      if (err.kind === 'quota' || err.kind === 'server') cooldownUntil[p] = Date.now() + (err.retryAfterMs || 60000);
      lastErr = err;
      errs.push(err);
      if (err.kind === 'bad_request' && req.json) {
        // some models reject response_format; retry once without it on the same provider
        try {
          const res = await deps.providers[p].chat({ ...req, json: false, messages: trimMessages(req.messages) }, key, cfg);
          await recordUsage(p, { requests: 1, tokensIn: res.tokensIn, tokensOut: res.tokensOut });
          return res;
        } catch { /* fall through to next provider */ }
      }
    }
  }
  if (!tried && !lastErr) throw new AIError('no_provider', 'Add a free Groq or Gemini API key in Profile → AI keys to enable the AI teacher.');
  if (errs.length > 1 && lastErr) throw new AIError(lastErr.kind, errs.map((x) => `${x.provider === 'gemini' ? 'Gemini' : 'Groq'}: ${x.message.slice(0, 160)}`).join(' · '), lastErr.retryAfterMs, lastErr.provider);
  throw lastErr || new AIError('no_provider', 'No AI provider available.');
}

/** Keep only recent turns and cap each message length – token budget control. */
export function trimMessages(msgs: ChatRequest['messages'], maxTurns = 8, maxChars = 1500) {
  return msgs.slice(-maxTurns).map((m) => ({ ...m, content: m.content.length > maxChars ? m.content.slice(0, maxChars) + '…' : m.content }));
}

export function extractJson<T = any>(text: string): T {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const first = s.search(/[{[]/);
  if (first > 0) s = s.slice(first);
  const lastObj = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastObj >= 0) s = s.slice(0, lastObj + 1);
  try { return JSON.parse(s) as T; } catch {
    // repair common issues: trailing commas
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')) as T; } catch {
      throw new AIError('parse', 'The AI answer could not be read. Please try again.');
    }
  }
}

export async function chatJson<T = any>(req: Omit<ChatRequest, 'json'>, deps?: RouterDeps): Promise<T> {
  const r = await chat({ ...req, json: true }, deps);
  return extractJson<T>(r.text);
}

export function _resetRouterState() {
  for (const k of Object.keys(cooldownUntil)) delete (cooldownUntil as any)[k];
  recentCalls.groq = []; recentCalls.gemini = [];
}

export function friendlyError(e: unknown): string {
  if (e instanceof AIError) return e.message;
  return 'Something went wrong. Please try again.';
}
