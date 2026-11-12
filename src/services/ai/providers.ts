import { HttpError, getJson, postJson } from '../platform';
import { AIError, type AIConfig, type ChatRequest, type ChatResult, type LLMProvider, type ProviderId } from './types';

export function classifyHttpError(e: unknown, provider: ProviderId): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof HttpError) {
    const msg = typeof e.body === 'object' ? JSON.stringify(e.body).slice(0, 300) : String(e.body).slice(0, 300);
    if (e.status === 429) {
      const daily = /per.?day|daily|RPD|TPD|quota/i.test(msg);
      return new AIError('quota', daily ? 'Free daily quota reached for ' + provider : 'Rate limit reached for ' + provider, daily ? 3600_000 : 60_000, provider);
    }
    if (e.status === 401 || e.status === 403) return new AIError('auth', `The ${provider} API key was rejected. Check it in Settings → AI keys.`, undefined, provider);
    if (e.status === 400 || e.status === 404 || e.status === 413 || e.status === 422) return new AIError('bad_request', `${provider} rejected the request (${e.status}). ${msg}`, undefined, provider);
    return new AIError('server', `${provider} server error (${e.status}). Try again shortly.`, 20_000, provider);
  }
  const m = (e as any)?.message || String(e);
  if (/abort/i.test(m)) return new AIError('network', `${provider} took too long to answer.`, 10_000, provider);
  return new AIError('network', `Could not reach ${provider}. Check your internet connection.`, 10_000, provider);
}

export const groqProvider: LLMProvider = {
  id: 'groq',
  async chat(req: ChatRequest, key: string, cfg: AIConfig): Promise<ChatResult> {
    if (req.image) throw new AIError('bad_request', 'Groq text models do not take images here', undefined, 'groq');
    const model = req.search ? 'groq/compound-mini' : req.tier === 'smart' ? cfg.groqSmart : cfg.groqFast;
    const body: any = {
      model,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      temperature: req.temperature ?? 0.4,
      max_completion_tokens: req.maxTokens ?? 700,
    };
    if (req.json && !req.search) body.response_format = { type: 'json_object' };
    if (/gpt-oss/.test(model)) body.reasoning_effort = 'low';
    try {
      const d = await postJson('https://api.groq.com/openai/v1/chat/completions', { Authorization: `Bearer ${key}` }, body);
      const text = d?.choices?.[0]?.message?.content ?? '';
      if (!text) throw new AIError('server', 'Groq returned an empty answer', 5000, 'groq');
      return { text, tokensIn: d?.usage?.prompt_tokens || 0, tokensOut: d?.usage?.completion_tokens || 0, provider: 'groq', model };
    } catch (e) { throw classifyHttpError(e, 'groq'); }
  },
};

export const geminiProvider: LLMProvider = {
  id: 'gemini',
  async chat(req: ChatRequest, key: string, cfg: AIConfig): Promise<ChatResult> {
    const model = req.tier === 'smart' || req.image || req.search ? cfg.geminiSmart : cfg.geminiFast;
    const contents = req.messages.map((m, i) => {
      const parts: any[] = [{ text: m.content }];
      if (req.image && i === req.messages.length - 1) parts.unshift({ inline_data: { mime_type: req.image.mime, data: req.image.base64 } });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
    const generationConfig: any = { temperature: req.temperature ?? 0.4, maxOutputTokens: req.maxTokens ?? 700 };
    if (req.json && !req.search) generationConfig.responseMimeType = 'application/json';
    if (/2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }; // save tokens; 2.5-pro ignores
    const body: any = { systemInstruction: { parts: [{ text: req.system }] }, contents, generationConfig };
    if (req.search) body.tools = [{ google_search: {} }];
    try {
      const d = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, body);
      const cand = d?.candidates?.[0];
      const text = (cand?.content?.parts || []).map((p: any) => p.text || '').join('');
      if (!text) {
        if (d?.promptFeedback?.blockReason) throw new AIError('bad_request', 'Gemini blocked this request: ' + d.promptFeedback.blockReason, undefined, 'gemini');
        throw new AIError('server', 'Gemini returned an empty answer', 5000, 'gemini');
      }
      const sources = (cand?.groundingMetadata?.groundingChunks || [])
        .map((c: any) => ({ title: String(c?.web?.title || c?.web?.uri || ''), uri: String(c?.web?.uri || '') }))
        .filter((x: any) => x.uri)
        .slice(0, 4);
      return { text, tokensIn: d?.usageMetadata?.promptTokenCount || 0, tokensOut: d?.usageMetadata?.candidatesTokenCount || 0, provider: 'gemini', model, sources };
    } catch (e) {
      // Model retired? Pick a current Flash model automatically and retry once.
      if (e instanceof HttpError && e.status === 404 && !(req as any)._retried) {
        const fixed = await autoPickGeminiModels(key, cfg);
        if (fixed) return geminiProvider.chat({ ...req, _retried: true } as any, key, fixed);
      }
      throw classifyHttpError(e, 'gemini');
    }
  },
};

export async function listModels(provider: ProviderId, key: string): Promise<string[]> {
  try {
    if (provider === 'groq') {
      const d = await getJson('https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${key}` });
      return (d?.data || []).map((m: any) => m.id).sort();
    }
    const d = await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': key });
    return (d?.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name).replace('models/', ''))
      .sort();
  } catch (e) {
    throw classifyHttpError(e, provider);
  }
}


/** When Google retires a model id, choose the newest available Flash / Flash-Lite and save it. */
export async function autoPickGeminiModels(key: string, cfg: AIConfig): Promise<AIConfig | undefined> {
  try {
    const list = await listModels('gemini', key);
    const ver = (m: string) => parseFloat((/gemini-(\d+(?:\.\d+)?)/.exec(m) || [, '0'])[1] as string);
    const stable = list.filter((m) => /^gemini-[\d.]+-flash/.test(m) && !/preview|exp|image|tts|audio|live|thinking/.test(m));
    const flash = stable.filter((m) => !/lite/.test(m)).sort((a, b) => ver(b) - ver(a))[0];
    const lite = stable.filter((m) => /lite/.test(m)).sort((a, b) => ver(b) - ver(a))[0];
    if (!flash && !lite) return undefined;
    const next = { ...cfg, geminiSmart: flash || lite!, geminiFast: lite || flash! };
    const { setKV } = await import('../db');
    await setKV('aiConfig', next);
    return next;
  } catch { return undefined; }
}
