# Test report – 4 Nov 2026

## Summary
| Suite | Result |
|---|---|
| TypeScript strict type-check | ✅ 0 errors |
| Unit tests (Vitest) | ✅ **48 / 48 passed** |
| End-to-end (Playwright, production build, 412×915) | ✅ **20 / 20 passed** |
| `npm audit` | ✅ 0 vulnerabilities |
| Secret scan (src, dist, android) | ✅ no API keys |
| Export leak check (E2E) | ✅ keys excluded |
| Web bundle | 372 KB JS (123 KB gzip), 13 KB CSS |
| Android APK compile | ⏳ not run here – see KNOWN_LIMITATIONS.md §1 |
| Physical Vivo V27 | ⏳ not available – checklist in KNOWN_LIMITATIONS.md |

## E2E cases
1 onboarding → home plan (9 tasks) · 2 bottom navigation · 3 dark/light theme · 4 no horizontal overflow (9 screens) ·
5 voice conversation → transcript review → AI reply → report (hallucinated correction filtered, 2 shown) ·
6 low-confidence transcript asks to repeat · 7 offline message · 8 picture challenge with model answer ·
9 vocabulary cards + sentence check + learn all → review · 10 grammar exercises → mastery · 11 interview → report ·
12 listening dialogue + questions · 13 assessment part saves · 14 progress from real sessions + weekly AI report ·
15 mistake marked fixed · 16 keys test, notifications notice, JSON export (no keys), delete recordings ·
17 429 rate limit with retry · 18 timer start/pause/resume/finish · 19 mic permission denied guidance · 20 no runtime errors.

## Bugs found by tests and fixed
- API keys were included in the JSON export in the browser build → export now filters `secret:*` (E2E asserts it).
- Concurrent screens could introduce duplicate daily word batches → serialised introduction (unit test added).
- Double-tapping “Got it” could skip a word → button disabled while saving.
- Session report ring mislabelled “fluency” → “overall”.
- Short answers scored too harshly on vocabulary → root-TTR range recalibrated (2.5→7.5) and documented.

Screenshots from the E2E run are in `tests/e2e/screens/` (not shipped in the APK).
