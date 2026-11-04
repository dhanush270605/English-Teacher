// Text-to-speech: native Android TTS in the APK, Web Speech synthesis in the browser.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNative } from '../platform';

let speakingToken = 0;

export function ttsSupported() {
  return isNative() || (typeof window !== 'undefined' && 'speechSynthesis' in window);
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices();
  return vs.find((v) => v.lang === lang && /google|natural|neural/i.test(v.name)) || vs.find((v) => v.lang === lang) || vs.find((v) => v.lang.startsWith('en'));
}

export async function speak(text: string, opts: { lang?: string; rate?: number; pitch?: number } = {}): Promise<void> {
  const lang = opts.lang || 'en-US';
  const rate = opts.rate ?? 1;
  const clean = text.replace(/[*_#`>]/g, '').trim();
  if (!clean) return;
  const token = ++speakingToken;
  if (isNative()) {
    try { await TextToSpeech.speak({ text: clean, lang, rate, pitch: opts.pitch ?? 1, volume: 1, queueStrategy: 0 }); } catch { /* stopped or unavailable */ }
    return;
  }
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  // Chrome stops long utterances – speak sentence by sentence.
  const parts = clean.match(/[^.!?]+[.!?]*/g) || [clean];
  for (const part of parts) {
    if (token !== speakingToken) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = lang; u.rate = rate; u.pitch = opts.pitch ?? 1;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      setTimeout(resolve, 15000 + part.length * 120); // safety
    });
  }
}

export async function stopSpeaking() {
  speakingToken++;
  if (isNative()) { try { await TextToSpeech.stop(); } catch { /* ignore */ } return; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function voicesAvailable(lang: string): Promise<boolean> {
  if (isNative()) {
    try { const { languages } = await TextToSpeech.getSupportedLanguages(); return languages.some((l) => l.toLowerCase().startsWith(lang.toLowerCase().slice(0, 5))); } catch { return true; }
  }
  return !!pickVoice(lang);
}
