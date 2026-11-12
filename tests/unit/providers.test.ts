import { HttpError } from '../../src/services/platform';
const calls: any[] = [];
let responder: (url: string, body: any) => any = () => ({});
vi.mock('../../src/services/platform', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    postJson: vi.fn(async (url: string, _h: any, body: any) => { calls.push({ url, body }); return responder(url, body); }),
    getJson: vi.fn(async (url: string) => {
      if (url.includes('groq')) return { data: [{ id: 'openai/gpt-oss-20b' }, { id: 'groq/compound' }, { id: 'groq/compound-mini-x' }] };
      return { models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] }] };
    }),
  };
});
import { geminiProvider, groqProvider } from '../../src/services/ai/providers';
import { DEFAULT_AI_CONFIG } from '../../src/services/ai/types';

const ok = (text: string, extra: any = {}) => ({ candidates: [{ content: { parts: [{ text }] }, ...extra }], usageMetadata: {} });
beforeEach(() => { calls.length = 0; });

describe('Gemini provider robustness', () => {
  it('Gemini 3 models get a large output budget and low thinking', async () => {
    responder = () => ok('hi');
    await geminiProvider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't', maxTokens: 600 }, 'k', { ...DEFAULT_AI_CONFIG, geminiFast: 'gemini-3.5-flash-lite' });
    expect(calls[0].body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(2400);
    expect(calls[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
  });
  it('retries with more tokens when thinking used them all', async () => {
    let n = 0;
    responder = () => (n++ === 0 ? { candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] } : ok('answer'));
    const r = await geminiProvider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't' }, 'k', { ...DEFAULT_AI_CONFIG, geminiFast: 'gemini-3.5-flash-lite' });
    expect(r.text).toBe('answer');
    expect(calls[1].body.generationConfig.maxOutputTokens).toBe(8192);
  });
  it('search request falls back to no-search when the tool is rejected', async () => {
    responder = (_u, body) => { if (body.tools) throw new HttpError(400, { error: { message: 'Search Grounding is not supported' } }); return ok('plain'); };
    const r = await geminiProvider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't', search: true }, 'k', DEFAULT_AI_CONFIG);
    expect(r.text).toBe('plain');
  });
  it('returns grounding sources', async () => {
    responder = () => ok('news', { groundingMetadata: { groundingChunks: [{ web: { uri: 'https://x.in/a', title: 'X' } }] } });
    const r = await geminiProvider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't', search: true }, 'k', DEFAULT_AI_CONFIG);
    expect(r.sources).toEqual([{ title: 'X', uri: 'https://x.in/a' }]);
  });
});

describe('Groq provider', () => {
  it('uses the compound model that actually exists for web search', async () => {
    responder = () => ({ choices: [{ message: { content: 'ans' } }], usage: {} });
    await groqProvider.chat({ system: 's', messages: [{ role: 'user', content: 'x' }], purpose: 't', search: true }, 'k', DEFAULT_AI_CONFIG);
    expect(calls[0].body.model).toBe('groq/compound');
  });
});
