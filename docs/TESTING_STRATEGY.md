# Testing strategy
| Level | Tool | What | How to run |
|---|---|---|---|
| Unit | Vitest + jsdom + fake-indexeddb | Text analysis, fillers, MTLD, alignment, timing metrics, all score formulas, hallucinated-correction filtering, SM-2, CEFR, streaks, planner, recommender, AI router (fallback, cooldown, offline, no-key, image routing, JSON repair, history trimming), HTTP error classification, notification schedules (ids, times, disabled categories, weekly, streak skip), DB profile/export, STT confidence rules, concurrency of word introduction, content integrity | `npm test` |
| End-to-end | Playwright (Chromium) on the **production build**, 412×915 phone viewport, touch, fake microphone fed from a WAV | Onboarding, navigation, theme switching, layout overflow on 9 screens, voice conversation → report, low-confidence path, 429 rate limit, offline, picture challenge, vocabulary, grammar, interview, listening, assessment, progress & weekly report, mistake dictionary, keys test, notifications screen, export (checks keys are NOT exported), deleting recordings, timer, mic permission denied, no runtime errors | `npm run test:e2e` |
| Security | npm audit, secret grep, export check, CSP | No vulnerable deps, no keys in source/build/export, network restricted to Groq, Gemini, Wikimedia | see TEST_REPORT.md |
| Android build | GitHub Actions | `assembleRelease`, `apksigner verify`, `aapt dump badging` | push to `main` |
| Physical device | Manual checklist (KNOWN_LIMITATIONS.md) | Mic, TTS voices, notifications when closed/after reboot, Vivo battery behaviour, real API calls | on the Vivo V27 |

External APIs are mocked in E2E so tests are deterministic and cost nothing; their real request formats follow the providers' documentation and are exercised for the first time on the device with real keys.
