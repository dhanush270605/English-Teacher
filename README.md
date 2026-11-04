# English Mastery – personal AI English teacher

A mobile-first, local-first English speaking coach for one learner (Tamil → English), built as a
Capacitor Android app (plus an installable PWA). Voice conversations with an AI teacher, measured
fluency analysis, picture/interview/impromptu speaking, vocabulary with spaced repetition, a 14-topic
grammar course, listening & pronunciation drills, adaptive daily plans, progress analytics and
scheduled Android reminders. **₹0 running cost**: free AI tiers with your own keys, no server.

## Download
- **Android app:** https://github.com/dhanush270605/English-Teacher/releases/latest/download/EnglishMastery.apk
- **Web version (no install):** https://dhanush270605.github.io/English-Teacher/

> Build/permissions/keys details: **[INSTALL_GUIDE.md](INSTALL_GUIDE.md)** (build the APK, install on the Vivo V27, permissions, API keys).

## Features
| Area | What it does |
|---|---|
| AI Teacher | 12 modes (friendly, daily, professional, college, workplace, travel, public speaking, group discussion, debate, interview, presentation, situational) + a recommended mode. Waits for you to finish, collects corrections for the end (or per turn / real-time tips). Rolling summary memory across sessions. |
| Voice | Record → Whisper transcript with word timings → editable review. Low-confidence recordings are flagged and you are asked to fix/repeat instead of being judged. Replay your recordings. Teacher replies are spoken (US/UK voice). Typing fallback. |
| Fluency analysis | Deterministic metrics: speech rate, articulation rate, pauses ≥0.25 s, long pauses ≥1 s, words between pauses, fillers, repetitions/restarts, MTLD diversity, less-common words, sentence length/subordination. Scores have published formulas ([docs/SCORING.md](docs/SCORING.md)). |
| Corrections | ORIGINAL → CORRECTED → NATURAL → WHY → PRACTICE, with optional Tamil hint. AI corrections are discarded unless the quoted words really appear in your transcript. Personal mistake dictionary. |
| Picture speaking | Real photos from Wikimedia Commons in 12 categories, 30 s / 60 s / 2 min, prep countdown, model answer, better expressions. |
| Interview trainer | HR, behavioural (STAR), project, technical-communication, internship, situational, GD; 3 levels; per-answer rubric, improved answer with the same meaning, full report and next recommendation. |
| Vocabulary | 5 practical words/day (configurable), IPA, Tamil meaning, examples, synonyms/antonyms, common mistake, mini-dialogue; SM-2 flashcards, quizzes, sentence check, misuse tracking, idioms. |
| Grammar | 14 bundled topics with rules, examples, common Tamil-speaker mistakes, Tamil notes, exercises, AI-checked sentence creation; mastery tracking; topics from your real mistakes come first. |
| Think in English | Impromptu talks with gradually longer durations, instant-response drill with start-latency measurement, story continuation, 2-minute emergency practice. |
| Listening & pronunciation | AI dialogues with US/UK voices + comprehension, accent comparison, minimal pairs for common Tamil-speaker confusions (v/w, z/j, th, ship/sheep…), hearing quiz, read-aloud word alignment (approximate). |
| Daily plan | Adaptive, deterministic (no tokens): vocab, grammar, speaking, picture, listening, pronunciation, thinking, revision, weekly assessment; no repeats within 30 days. |
| Progress | Level, overall trend, skill bars vs previous period, speaking minutes, streak, weekly goal, common mistakes, strongest/weakest skill, AI weekly report from statistics only. |
| Assessment | 5-part informal CEFR estimate (grammar ladder, yes/no vocab with pseudo-words, 2 speaking tasks, listening); history for improvement. |
| Reminders | 13 categories, editable times, snooze, tap-to-open activity, streak reminders skipped once today's goals are done, reboot-safe, Vivo battery guide, test notification. |
| Privacy | Everything stays on the phone. Delete recordings/history, export JSON (keys excluded), disable recording storage, clear all data. |

## Project layout
```
src/
  engine/        deterministic analysis: text, metrics, scoring, srs, scheduler, recommender, cefr
  services/      db (Dexie/IndexedDB), platform (keys, native HTTP), learning orchestration, pictures
    ai/          provider abstraction (Groq, Gemini), router (fallback, quotas, usage), prompts
    speech/      recorder, speech-to-text, text-to-speech
  notifications/ local notification scheduling
  data/content/  grammar course, word list, topics, interview banks, minimal pairs, assessment
  ui/            components, icons, SpeakCapture (voice pipeline), report views
  screens/       one file per screen
tests/unit       Vitest (engines, router, notifications, db, content integrity)
tests/e2e        Playwright on the production build, phone viewport, fake microphone, mocked APIs
android/         Capacitor Android project
docs/            plan, architecture, research, database, testing, scoring, limitations, logs
```

## Commands
```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (48)
npm run test:e2e     # build + end-to-end tests (20)
npm run build        # production web build → dist/
npx cap sync android # copy build into the Android project
```

## Docs
[Project plan](docs/PROJECT_PLAN.md) · [Architecture](docs/SYSTEM_ARCHITECTURE.md) · [Tech stack](docs/TECH_STACK.md) ·
[API & resource research](docs/API_AND_RESOURCE_RESEARCH.md) · [Database](docs/DATABASE_DESIGN.md) ·
[Scoring formulas](docs/SCORING.md) · [Testing strategy](docs/TESTING_STRATEGY.md) · [Test report](docs/TEST_REPORT.md) ·
[Feature roadmap](docs/FEATURE_ROADMAP.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md) · [Development log](docs/DEVELOPMENT_LOG.md)
