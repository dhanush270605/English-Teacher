// Microphone recording with level metering, silence detection and a hard length cap.
// The mic is opened only while recording and all tracks are stopped afterwards (no background recording).

export type RecorderError = 'permission' | 'nomic' | 'unsupported' | 'error';

export interface RecordingResult { blob: Blob; durationSec: number; voicedRatio: number; mime: string }

export interface RecorderOptions {
  onLevel?: (level: number) => void; // 0..1 for waveform
  onSilence?: () => void; // fired once after `silenceMs` of silence following speech
  onNoSpeech?: () => void; // fired if nothing heard for `noSpeechMs`
  silenceMs?: number;
  noSpeechMs?: number;
  maxSec?: number;
  onMaxReached?: () => void;
}

export function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
  }
  return '';
}

export class Recorder {
  private stream?: MediaStream;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private ctx?: AudioContext;
  private raf = 0;
  private started = 0;
  private voicedFrames = 0;
  private frames = 0;
  private lastVoice = 0;
  private heardSpeech = false;
  private silenceFired = false;
  private noSpeechFired = false;
  private maxTimer?: number;
  private pausedAt = 0;
  private pausedTotal = 0;
  mime = '';

  static supported() {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  }

  async start(opts: RecorderOptions = {}): Promise<void> {
    if (!Recorder.supported()) throw Object.assign(new Error('Recording is not supported on this device/browser.'), { code: 'unsupported' as RecorderError });
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e: any) {
      const code: RecorderError = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'permission' : e?.name === 'NotFoundError' ? 'nomic' : 'error';
      throw Object.assign(new Error(code === 'permission' ? 'Microphone permission was denied.' : code === 'nomic' ? 'No microphone found.' : 'Could not start the microphone.'), { code });
    }
    this.mime = pickMime();
    this.rec = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime, audioBitsPerSecond: 32000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000);
    this.started = performance.now();
    this.lastVoice = this.started;
    this.meter(opts);
    const maxSec = opts.maxSec ?? 180;
    this.maxTimer = window.setTimeout(() => opts.onMaxReached?.(), maxSec * 1000);
  }

  private meter(opts: RecorderOptions) {
    try {
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream!);
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const silenceMs = opts.silenceMs ?? 0;
      const noSpeechMs = opts.noSpeechMs ?? 10000;
      let noiseFloor = 0.02;
      const tick = () => {
        if (this.rec?.state === 'paused') { this.raf = requestAnimationFrame(tick); return; }
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        // adaptive noise floor handles background noise (fans, traffic)
        if (rms < noiseFloor * 1.5) noiseFloor = noiseFloor * 0.98 + rms * 0.02;
        const voiced = rms > Math.max(0.025, noiseFloor * 2.5);
        this.frames++;
        const now = performance.now();
        if (voiced) { this.voicedFrames++; this.lastVoice = now; this.heardSpeech = true; }
        opts.onLevel?.(Math.min(1, rms * 6));
        if (silenceMs && this.heardSpeech && !this.silenceFired && now - this.lastVoice > silenceMs) { this.silenceFired = true; opts.onSilence?.(); }
        if (!this.heardSpeech && !this.noSpeechFired && now - this.started > noSpeechMs) { this.noSpeechFired = true; opts.onNoSpeech?.(); }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch { /* metering is optional */ }
  }

  pause() { if (this.rec?.state === 'recording') { this.rec.pause(); this.pausedAt = performance.now(); } }
  resume() { if (this.rec?.state === 'paused') { this.rec.resume(); this.pausedTotal += performance.now() - this.pausedAt; } }

  elapsed() { return this.started ? (performance.now() - this.started - this.pausedTotal) / 1000 : 0; }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.rec) return reject(new Error('Not recording'));
      const durationSec = this.elapsed();
      this.rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mime || 'audio/webm' });
        const voicedRatio = this.frames ? this.voicedFrames / this.frames : 0;
        this.cleanup();
        resolve({ blob, durationSec, voicedRatio, mime: blob.type });
      };
      try { this.rec.stop(); } catch (e) { this.cleanup(); reject(e); }
    });
  }

  cancel() {
    try { if (this.rec && this.rec.state !== 'inactive') { this.rec.onstop = null; this.rec.stop(); } } catch { /* ignore */ }
    this.cleanup();
  }

  private cleanup() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.maxTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = undefined; this.rec = undefined; this.ctx = undefined;
  }
}
