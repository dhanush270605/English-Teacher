# Tech stack
| Layer | Choice | Version | Why |
|---|---|---|---|
| UI | Preact + TypeScript | 10.x / 5.9 | React-like, ~4 KB runtime – small APK, fast on mid-range phones |
| Build | Vite | 8.x | Fast builds, tree-shaking (web bundle ≈ 123 KB gzip) |
| Native shell | Capacitor | 8.6 | Real Android app from the web build; official plugins |
| Notifications | @capacitor/local-notifications | 8.3 | AlarmManager scheduling, channels, actions, reboot restore, exact-alarm handling |
| TTS | @capacitor-community/text-to-speech | 8.0 | Android TextToSpeech with US/UK voices, pitch/rate |
| Key storage | @capacitor/preferences | 8.0 | App-private SharedPreferences (backups disabled) |
| HTTP | CapacitorHttp (core) | 8.6 | Native requests (no CORS), multipart audio upload |
| Database | Dexie (IndexedDB) | 4.4 | Local-first, indexed, transactions, live queries |
| Charts | Hand-written SVG | – | No chart library weight |
| STT | Groq Whisper large-v3-turbo | API | Free tier, word timestamps, log-probs |
| LLM | Groq gpt-oss-20b / 120b; Gemini 2.5 Flash-Lite / Flash | API | Free tiers, provider abstraction, configurable model ids |
| Images | Wikimedia Commons API | API | Free, openly licensed, no key |
| Tests | Vitest + fake-indexeddb; Playwright (Chromium) | 5.1 | Unit + phone-viewport E2E with fake microphone |
| CI/APK | GitHub Actions (JDK 21, Android SDK, Gradle 8.14, AGP 8.13) | – | Free APK builds without local tools |
