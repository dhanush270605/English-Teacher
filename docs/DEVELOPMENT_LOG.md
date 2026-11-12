# Development log
**2026-11-04**
- Inspected environment: project folder `D:\PROJECT\English Learner` empty; no `plugins` folder; laptop sandbox and build container both blocked from dl.google.com / maven.google.com / services.gradle.org → no Android SDK. npm registry reachable.
- Decision: Capacitor 8 (web UI testable here + native Android) instead of Flutter; no backend (see PROJECT_PLAN.md).
- Verified current free tiers (Groq Whisper limits incl. word timestamps; Gemini limits via AI Studio). Verified in Capacitor 8 source that CapacitorHttp supports multipart `base64File` uploads (needed for Whisper from the APK) and that local-notifications ships a BOOT_COMPLETED restore receiver and exact-alarm APIs.
- Built engines (text, metrics, scoring, SM-2, planner, recommender, CEFR) test-first: 26 tests. Two test expectations corrected (alignment tie-break is ambiguous; restart detection window).
- Built AI router with fallback/cooldown/caps/usage + prompts; STT with confidence assessment; TTS; notifications. 47 tests.
- Wrote bundled content: 14 grammar topics (84 exercises), 242 practical words, 48 topics, 8 interview banks × 3 levels, 9 minimal-pair sets, assessment items.
- Built all screens and the voice pipeline component; strict type-check clean.
- E2E run 1: 11/20 – failures traced to: (a) test order – the 429 test put Groq in a 1-hour daily-quota cooldown (correct router behaviour) → moved test to the end; (b) **real bug** API keys in export → fixed; (c) theme assertion timing; (d) test waited before data loaded.
- E2E run 2: 18/20 – (e) **real bug** duplicate word batches from concurrent callers → lock + unit test; (f) onboarding navigation race in test.
- E2E run 3: 19/20 – (g) double-tap skipping words → disabled button while saving. E2E 20/20.
- Android project generated (`cap add android`), manifest hardened (backup off, cleartext off, mic/notification permissions, TTS query), icons/splash replaced, signing via env/secrets, CI workflow with signature verification.
- npm audit clean; secret scan clean.

**2026-11-12 – v2 (user feedback from the Vivo V27)**
- Picture challenge images failed: Wikimedia rejects non-standard thumbnail widths (900px). Now uses standard widths (960/500/1280/330), falls back to the original, then a native download, then auto-skips to another photo.
- Think in English: "quick practice" flag hijacked Story/Impromptu into the instant-answers flow and a late async topic pick changed the topic after Start. Screen rewritten; Story mode has real story starters.
- Conversation: teacher replies are text-only by default (voice toggle kept). Under every learner message: full corrected version with struck-out mistakes, natural version, speed/pauses/fillers, and a "Why?" list.
- Stronger role rules: debate always argues the opposite side; group discussion voices several people; interview/workplace/travel stay in character.
- Vocabulary: AI picks expressive upper-intermediate/advanced words by daily theme, never repeats; seed list replaced with B2/C1 conversational words; "I already know this" swaps a word.
- New: Ask-me-anything friend mode (Gemini + Google Search grounding, Groq compound fallback), voice replies, sources, inline corrections.
- New: Fluency Gym (4-3-2 drill, shadowing, thinking phrases) and a live "keep going" pause nudge while recording.
- Gemini is now the first provider; retired Gemini model ids are replaced automatically from the live model list.
- New: over-the-air updates (version.json + web-bundle.zip on each GitHub release; Capacitor WebView.setServerBasePath; same origin so data is kept). CI now runs unit + E2E tests before publishing.
- Tests: 54 unit, 23 E2E passing.
