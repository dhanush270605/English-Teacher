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
