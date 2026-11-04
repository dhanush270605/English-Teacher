# Database design (IndexedDB via Dexie, database `english-mastery`, version 1)
All data is on the device. No account, no cloud copy.

| Table | Key / indexes | Contents |
|---|---|---|
| `kv` | key | profile, AI config, notification settings, active days (streak), practice seconds per day, teacher memory summary, assessment draft. Web build only: `secret:*` API keys (never exported). |
| `sessions` | ++id, type, startedAt | type (conversation, picture, interview, impromptu, assessment, listening, pronunciation…), mode, timestamps, duration, **speakingSec** (from word timings – idle time not counted), scores, metrics, mistakeCount, report JSON |
| `turns` | ++id, sessionId, [sessionId+idx] | conversation messages, transcript (words/segments/confidence), verified corrections, relevance |
| `recordings` | ++id, sessionId, createdAt | audio Blob (Opus), duration. Optional (Privacy toggle). Auto-deleted after 14 days. |
| `mistakes` | ++id, sessionId, ts, category | original, corrected, natural, why, practice, resolved |
| `words` | word, status, due, introducedAt | level, AI details (meaning, Tamil, IPA, examples…), SM-2 state (ef, interval, reps, due), correct/wrong/misuse counts |
| `grammar` | topicId | attempts, correct, recent 20 results, mastery %, lastStudied |
| `tasks` | ++id, date, [date+kind], status | daily plan items with title, difficulty, minutes, objective, instructions, route, status, score |
| `history` | ++id, key, ts | content used (pictures, topics, questions) – prevents repetition (30–60 days) |
| `notifLog` | ++id, ts | notification opens/snoozes |
| `usage` | id = date\|provider, date, provider | requests, tokens in/out, audio seconds, errors (API usage monitor) |
| `cache` | key, ts | Commons search results, listening dialogues, weekly narratives |
| `assessments` | ++id, ts | parts, CEFR estimate, composite, breakdown |

**Learner profile** (kv `profile`): name, level, levelSource, goals, dailyMinutes, wordsPerDay, accent, feedbackMode, storeRecordings, cloudAudioConsent, theme, tamilHelp, adaptive difficulty 1–5, weeklyGoalMinutes.

**Learner context sent to AI** (≤ ~500 chars): level, difficulty, top recurring error categories (21 days), 60-word rolling summary – never the full history.
