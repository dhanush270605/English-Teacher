# System architecture

```
┌──────────────────────── Android app (Capacitor WebView) ────────────────────────┐
│  UI (Preact screens)                                                             │
│   Home · AI Teacher · Practice (picture, interview, vocab, grammar, thinking,    │
│   listening, pronunciation, assessment, timer) · Progress · Profile/Settings     │
│        │                         │                          │                    │
│  SpeakCapture (voice pipeline)   Report views          Notifications UI          │
│        │                                                                         │
│  Services ─────────────────────────────────────────────────────────────────────  │
│   speech/recorder (MediaRecorder, level meter, silence/no-speech detection)       │
│   speech/stt  ──► Groq Whisper (verbose_json) ─► fallback Gemini audio            │
│   speech/tts  ──► Android TextToSpeech (native plugin) / Web Speech in browser    │
│   ai/router   ──► providers: Groq (gpt-oss) ⇄ Gemini (flash/flash-lite)           │
│                   ordered fallback · local RPM limiter · daily caps · cooldown    │
│                   on 429/5xx · usage table · JSON repair                           │
│   learning    ──► plan, sessions, mistakes, words, grammar mastery, stats         │
│   pictures    ──► Wikimedia Commons search API (cached 14 days)                   │
│   platform    ──► keys (Android SharedPreferences, app-private) · CapacitorHttp   │
│                                                                                  │
│  Engines (pure, unit-tested, zero tokens)                                        │
│   text · metrics · scoring · srs (SM-2) · scheduler · recommender · cefr          │
│                                                                                  │
│  Data: IndexedDB via Dexie (sessions, turns, recordings, mistakes, words, …)     │
│  Native: LocalNotifications (AlarmManager + boot receiver) · TextToSpeech ·      │
│          Preferences · App (back button)                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Voice turn (AI Teacher)
1. Mic tap → `Recorder.start` (echo cancellation, noise suppression, adaptive noise floor). Mic is released on stop.
2. Stop → audio (Opus/WebM, 32 kbps) → Groq Whisper with a disfluent prompt (keeps “umm/uh”) → words + timings + log-probs.
3. `assessConfidence` flags empty / silent / unclear audio → learner edits or re-records (never judged on misheard words).
4. Learner confirms text → router → teacher prompt (last 8 turns, compact learner context, rolling summary) → JSON `{reply, corrections, relevance}`.
5. Corrections are kept only if their `original` text appears verbatim in the transcript.
6. Reply is spoken by TTS; corrections shown at end (default), per turn, or as real-time tips.
7. End → `sessionMetrics` (per-answer timing, turn gaps not counted as pauses) + `scoreSession` → report, mistakes, task completion, streak, summary memory.

## Token budget controls
Local openers; plan/scoring/streaks/SRS without AI; max 8 recent turns, 1 500 chars each; 60-word rolling summary every 8 turns; word details generated once per word in batches of 5 and cached; dialogues cached per theme/level/accent; weekly narrative cached per week and fed statistics only; fast models for chat, smart only for analysis; `max_tokens` on every call; reasoning effort “low” / Gemini thinking budget 0.

## Failure handling
Offline → clear message, typing still works, practice saved. Provider 429/5xx → cooldown and automatic fallback. Bad key → message linking to key settings. JSON parse failures → repair attempt then friendly retry. AI unavailable during analysis → measured scores still shown, grammar score omitted (not guessed). Mic denied → instructions. Unfinished conversations → resumable.
