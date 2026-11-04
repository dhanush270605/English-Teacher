# Project plan

## Goal
A personal AI English speaking coach for one Tamil-speaking learner on a Vivo V27, at ₹0 running cost,
that measures progress honestly and adapts daily practice to real mistakes.

## Key decisions (and why)
| Decision | Reason | Trade-off |
|---|---|---|
| **Capacitor (web UI + native Android shell)** instead of Flutter | Flutter/Android SDK could not be downloaded in the build environment; Capacitor lets the whole app be built and tested here as a web app while still producing a real APK with native notifications, TTS and HTTP. | Final APK compile happens on GitHub Actions or the user's Android Studio. |
| **No backend server** (spec suggested FastAPI) | A single user with their own free keys gains nothing from a server; a free host would add cold starts, an always-online dependency, another place holding the key, and maintenance. Keys are entered at runtime and stored in app-private storage – never in source/APK. | If the phone is compromised the key is exposed; keys are free and revocable. |
| **Groq Whisper for speech-to-text** | Free tier with word-level timestamps + per-segment log-probabilities, which make pause/fluency metrics and confidence checks possible. Android WebView has no Web Speech API. | Audio is uploaded (consent screen, toggle in Privacy). |
| **IndexedDB (Dexie) instead of SQLite** | Same local-first role as SQLite inside a WebView, zero native plugin risk, works identically in tests. | No SQL; queries are indexed key lookups. |
| **Deterministic scoring** | The spec forbids arbitrary LLM scores. All scores are formulas over measured evidence; the LLM only proposes corrections (verified against the transcript) and a 0–4 relevance rubric, labelled as such. | Pronunciation is approximate (no free phoneme-level scorer). |
| **Deterministic daily planner** | Plan generation costs zero tokens and is reproducible/testable. | Less "creative" than an LLM-written plan. |
| **Local opening questions** | Each conversation's first question is local; the AI is called only after the learner speaks. | – |

## Phases (all completed except physical-device verification)
1. Inspect environment – done (empty project folder, no `plugins` folder present, no Android SDK reachable).
2. Research – done (see API_AND_RESOURCE_RESEARCH.md).
3. Architecture & plan – done (this folder).
4. Setup – Vite + Preact + TypeScript + Dexie + Capacitor 8.
5. Frontend – 25+ screens, light/dark theme, phone-first.
6. Data layer – IndexedDB schema (DATABASE_DESIGN.md).
7. AI, speech, grammar, learning engines – done.
8. Notifications, timer, analytics – done.
9. Security & performance – CSP, no secrets in code/export, backups disabled, mic only while recording, 14-day audio cleanup, token budgets.
10. Testing – 48 unit + 20 end-to-end tests passing (TEST_REPORT.md).
11. Repair – bugs found by tests fixed (DEVELOPMENT_LOG.md).
12. Android build – project + CI workflow ready; APK compile requires Route A or B in INSTALL_GUIDE.md.
13. Delivery – this folder.
