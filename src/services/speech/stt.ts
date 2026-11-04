// Speech-to-text with confidence awareness.
// Primary: Groq Whisper (verbose_json → word timings + per-segment log-probabilities).
// Fallback: Gemini audio transcription (no timings). Browser-only live mode: Web Speech API.
import type { Transcript } from '../../types';
import { getProfile } from '../db';
import { blobToBase64, getSecret, isOnline, postMultipart } from '../platform';
import { classifyHttpError } from '../ai/providers';
import { getAIConfig, recordUsage } from '../ai/router';
import { chat } from '../ai/router';
import { AIError } from '../ai/types';
import { tokenize } from '../../engine/text';

// A disfluent prompt nudges Whisper to keep fillers instead of silently cleaning them up.
const WHISPER_PROMPT = 'Umm, let me think, like, hmm... Okay, so, uh, I was, I was going to the, uh, market, you know.';

export function assessConfidence(t: Transcript, voicedRatio?: number): Transcript {
  const words = tokenize(t.text).length;
  let low = false, reason = '';
  if (!words) { low = true; reason = 'No speech was recognised.'; }
  else if (voicedRatio !== undefined && voicedRatio < 0.04 && t.durationSec > 3) { low = true; reason = 'Very little voice was detected – it may be too quiet or noisy.'; }
  else if (t.segments?.length) {
    const bad = t.segments.filter((s) => (s.noSpeechProb ?? 0) > 0.6 || (s.avgLogprob ?? 0) < -1.0);
    const clarity = t.confidence ?? 1;
    if (bad.length / t.segments.length > 0.34 || clarity < 0.55) { low = true; reason = 'Parts of the recording were unclear.'; }
  }
  if (!low && t.durationSec > 5 && words / t.durationSec < 0.4) { low = true; reason = 'Only a few words were recognised for a long recording.'; }
  return { ...t, lowConfidence: low, lowConfidenceReason: reason || undefined };
}

export async function sttAvailability(): Promise<{ cloud: boolean; engine: 'groq' | 'gemini' | null; consent: boolean }> {
  const p = await getProfile();
  const groq = await getSecret('groqKey');
  const gem = await getSecret('geminiKey');
  return { cloud: !!(groq || gem), engine: groq ? 'groq' : gem ? 'gemini' : null, consent: p.cloudAudioConsent };
}

function extFor(mime: string) {
  return mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
}

export async function transcribeGroq(blob: Blob, durationSec: number, key: string, model: string): Promise<Transcript> {
  try {
    const d = await postMultipart(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      { Authorization: `Bearer ${key}` },
      [['model', model], ['response_format', 'verbose_json'], ['language', 'en'], ['temperature', '0'], ['timestamp_granularities[]', 'word'], ['timestamp_granularities[]', 'segment'], ['prompt', WHISPER_PROMPT]],
      { key: 'file', blob, name: 'speech.' + extFor(blob.type) },
    );
    await recordUsage('groq-stt', { requests: 1, audioSec: Math.ceil(durationSec) });
    const segments = (d.segments || []).map((s: any) => ({ start: s.start, end: s.end, text: s.text, avgLogprob: s.avg_logprob, noSpeechProb: s.no_speech_prob }));
    let words = (d.words || []).map((w: any) => ({ word: String(w.word).trim(), start: w.start, end: w.end }));
    const text = String(d.text || '').trim();
    if (!words.length) words = undefined;
    let conf: number | undefined;
    if (segments.length) {
      let tot = 0, ws = 0;
      for (const s of segments) { const dur = Math.max(0.1, s.end - s.start); tot += Math.exp(s.avgLogprob ?? -0.3) * dur; ws += dur; }
      conf = tot / ws;
    }
    return { text: stripWhisperHallucination(text), words, segments, durationSec: d.duration || durationSec, engine: 'groq-whisper', confidence: conf };
  } catch (e) {
    await recordUsage('groq-stt', { requests: 1, errors: 1 });
    throw classifyHttpError(e, 'groq');
  }
}

/** Whisper sometimes outputs stock phrases on near-silence. */
export function stripWhisperHallucination(t: string): string {
  const s = t.trim();
  if (/^(thank you\.?|thanks for watching!?|you|bye\.?|\.+)$/i.test(s)) return '';
  return s;
}

export async function transcribeGemini(blob: Blob, durationSec: number): Promise<Transcript> {
  const b64 = await blobToBase64(blob);
  const mime = (blob.type || 'audio/webm').split(';')[0];
  // Gemini audio goes through the generic chat with inline data (image field reused for any media).
  const r = await chat({
    purpose: 'stt',
    system: 'Transcribe the English speech verbatim, keeping fillers (um, uh, like) and repetitions. Do not correct grammar. Return ONLY JSON {"text":"...","clarity":0-1}. If no speech, text is "".',
    messages: [{ role: 'user', content: 'Transcribe this recording.' }],
    image: { mime, base64: b64 },
    json: true,
    maxTokens: 800,
    temperature: 0,
  });
  let text = '', clarity: number | undefined;
  try { const j = JSON.parse(r.text.replace(/^```(json)?|```$/g, '')); text = j.text || ''; clarity = typeof j.clarity === 'number' ? j.clarity : undefined; } catch { text = r.text; }
  return { text: text.trim(), durationSec, engine: 'gemini-audio', confidence: clarity };
}

export async function transcribe(blob: Blob, durationSec: number, voicedRatio?: number): Promise<Transcript> {
  if (!isOnline()) throw new AIError('offline', 'You are offline. Type your answer instead, or try again when connected.');
  const p = await getProfile();
  if (!p.cloudAudioConsent) throw new AIError('auth', 'consent-required');
  if (voicedRatio !== undefined && voicedRatio < 0.01 && durationSec > 2) {
    return { text: '', durationSec, engine: 'groq-whisper', lowConfidence: true, lowConfidenceReason: 'No voice detected. Check the microphone and speak a little louder.' };
  }
  const cfg = await getAIConfig();
  const groq = await getSecret('groqKey');
  let lastErr: unknown;
  if (groq) {
    try { return assessConfidence(await transcribeGroq(blob, durationSec, groq, cfg.whisperModel), voicedRatio); } catch (e) { lastErr = e; }
  }
  if (await getSecret('geminiKey')) {
    try { return assessConfidence(await transcribeGemini(blob, durationSec), voicedRatio); } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  throw new AIError('no_provider', 'Add a free Groq API key (best) or Gemini key in Profile → AI keys to turn speech into text.');
}

// ---------- Web Speech API (browser / installed PWA only; not available in Android WebView) ----------
export function webSpeechSupported() {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export class LiveRecognizer {
  private r: any;
  private finalText = '';
  private confs: number[] = [];
  private startedAt = 0;
  onPartial?: (text: string) => void;

  start(lang = 'en-US') {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.r = new SR();
    this.r.lang = lang; this.r.interimResults = true; this.r.continuous = true; this.r.maxAlternatives = 1;
    this.finalText = ''; this.confs = []; this.startedAt = Date.now();
    this.r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { this.finalText += ' ' + res[0].transcript; if (res[0].confidence) this.confs.push(res[0].confidence); }
        else interim += res[0].transcript;
      }
      this.onPartial?.((this.finalText + ' ' + interim).trim());
    };
    this.r.onerror = () => {};
    this.r.start();
  }

  stop(): Promise<Transcript> {
    return new Promise((resolve) => {
      const done = () => {
        const conf = this.confs.length ? this.confs.reduce((a, b) => a + b, 0) / this.confs.length : undefined;
        resolve(assessConfidence({ text: this.finalText.trim(), durationSec: (Date.now() - this.startedAt) / 1000, engine: 'web-speech', confidence: conf }));
      };
      if (!this.r) return done();
      this.r.onend = done;
      try { this.r.stop(); } catch { done(); }
      setTimeout(done, 1500);
    });
  }
}
