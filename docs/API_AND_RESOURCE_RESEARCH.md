# API & resource research (checked 4 Nov 2026)
Free tiers change – re-check the provider pages before relying on numbers. The app never assumes unlimited use:
it keeps local daily caps below these limits, shows usage, and falls back between providers.

## Speech-to-text
| Option | Verdict |
|---|---|
| **Groq Whisper large-v3 / v3-turbo** | **Chosen.** Free plan listed at 20 requests/min, 2 000/day, 7 200 audio-seconds/hour, 28 800 audio-seconds/day (≈ 8 h/day). `verbose_json` returns word + segment timestamps and per-segment `avg_logprob`/`no_speech_prob`. Free tier file limit 25 MB; webm/ogg/m4a accepted. Sources: developersdigest.tech/rate-limits/groq (verified 17 Oct 2026), console.groq.com/docs/speech-to-text. |
| Gemini audio input | Fallback: transcribes inline audio, but no timestamps/confidence → fluency marked partial. |
| Web Speech API | Used only in the browser/PWA (Chrome); **not available in Android WebView**; no timings. |
| Android SpeechRecognizer plugin | Community plugin is on Capacitor 7; no word timings; rejected to keep the native build risk-free. |
| Vosk / Sherpa-ONNX / whisper.cpp on-device | Free and private but 40–150 MB models, high CPU/battery on phone, weaker accuracy on Indian-accented English for small models; conflicts with the low-storage requirement. Possible future “offline mode”. |

## LLM (teacher, corrections, content)
| Option | Verdict |
|---|---|
| **Groq** – openai/gpt-oss-20b (fast), gpt-oss-120b (smart) | **Primary.** Listed free plan: 30 RPM, 1 000 RPD, 8 K TPM, 200 K TPD per model. Fast inference suits voice turns. |
| **Google Gemini API** – 2.5 Flash-Lite (fast), 2.5 Flash (smart, vision) | **Fallback + picture vision.** Free tier via AI Studio key; limits are per project and model and shown in AI Studio (official page no longer lists fixed numbers; third-party summaries in 2026 quote ~10 RPM / few hundred RPD for Flash). Free-tier prompts may be used by Google to improve products – disclosed in the app. Sources: ai.google.dev/gemini-api/docs/rate-limits, dev.to Gemini free-tier cheatsheet (May 2026). |
| OpenAI / Anthropic APIs | No free tier – excluded (no paid dependencies). |
| Local LLM on phone | Too large for the storage/battery goals. |
Model ids are configurable and the app can list currently available models from each provider (“Test & load models”), so a retired default doesn't break the app.

## Text-to-speech
Android's built-in TTS engine (Google Speech Services) via `@capacitor-community/text-to-speech`: free, offline once voices are installed, US/UK voices, rate/pitch control. Browser: Web Speech synthesis.

## Pronunciation assessment
No free phoneme-level scoring API was found that fits ₹0 and privacy (Azure/Speechace/ELSA-style APIs are paid or trial-limited). The app therefore uses **approximate** signals – Whisper clarity and read-aloud word alignment – and labels them approximate everywhere.

## Images
Wikimedia Commons API (`generator=search`, `prop=imageinfo`, `origin=*`): free, no key, openly licensed photos with author/licence metadata (shown under each image). Results cached 14 days; used images not repeated for 60 days. AI image generation not used (no reliable free tier).

## Notifications / background
Local notifications through AlarmManager (Capacitor plugin) – no server, works offline, re-scheduled after reboot by the plugin's boot receiver. Android 13+ needs POST_NOTIFICATIONS; Android 12+ exact alarms may need user approval (handled in-app with fallback to inexact). Vivo Funtouch/OriginOS aggressively stops background apps → in-app guide (battery “Allow”, Autostart, lock in recents). Firebase Cloud Messaging rejected: needs a server to send pushes and gives no benefit for fixed local schedules.

## Hosting / database
No hosting needed. Local IndexedDB. Optional future sync could use the user's own Google Drive export; not required.

## Competitor review (public features & user feedback)
| App | Strengths to learn from | Common complaints (public reviews) | What this app does instead |
|---|---|---|---|
| ELSA Speak | Phoneme-level pronunciation feedback, initial assessment, progress tracking, daily goals | Price/refunds, correct pronunciations marked wrong, bugs/freezes on weak internet, clicking “Continue” repeatedly, little explanation of stress/intonation | Honest “approximate” labelling, editable transcripts instead of unfair judging, offline-safe lessons, stress minimal pairs |
| Praktika | Low-pressure AI conversation, avatars with accents, fluency dashboard | Aggressive paywall before trying, robotic voices, inaccurate AI pronunciation | Free, own keys, native TTS voices with accent choice |
| Speak | Speaking-first lessons, role-plays | Subscription cost; limited free use | 12 role-play modes, all free |
| Duolingo | Streaks, gamified habit, short lessons | Little real speaking, unnatural sentences | Real open conversation + streak/habit features |
| HelloTalk / Tandem | Real people, real conversations | Finding partners, inconsistent quality, social anxiety | AI partner with zero judgement; still recommends real conversation |
| Cake / BBC Learning English / British Council | Free authentic content, clear grammar explanations | Passive learning | Bundled grammar course tied to the learner's own mistakes |
| Grammarly | Clear corrections with explanations | Writing-only | Same correction clarity for **speech**, plus Tamil hints |
| Busuu | Structured CEFR path, community feedback | Paywall, slow feedback | Informal CEFR estimate, instant feedback |
Sources for review themes: Capterra ELSA Speak reviews (175 reviews, accessed Nov 2026); marlvel.ai Praktika review report (May 2026); app-store summaries. Feature notes are from public product pages; no code, branding or content was copied.

## Gaps this app targets
Mother-tongue-aware help (Tamil hints, Tamil-speaker minimal pairs and grammar traps), corrections pinned to the learner's exact words, transparent scoring, mistake-driven grammar plans, interview + picture + impromptu speaking in one place, zero cost.
