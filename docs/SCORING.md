# Scoring formulas
Every score is reproducible from the saved transcript + timings. Implementation: `src/engine/scoring.ts`, `metrics.ts`, `text.ts`.
`lin(x, a, b)` = linear map of x from a→0 to b→100, clamped to 0–100.

## Measurements
| Metric | Definition |
|---|---|
| Speech rate (wpm) | words ÷ (last word end − first word start) × 60 |
| Articulation rate | words ÷ (speaking time − pauses) × 60 |
| Pause / long pause | gap between words ≥ 0.25 s / ≥ 1.0 s |
| Mean length of run (MLR) | average words between pauses ≥ 0.25 s |
| Run-length CV | standard deviation ÷ mean of run lengths |
| Phonation ratio | (speaking time − pauses) ÷ recording length |
| Fillers | always: um/uh/er/hmm…; discourse: “you know”, “I mean”, “kind of”, “sort of”, “actually”, “basically”, “literally”, discourse “like” (not “I like tea”) |
| Repeats / restarts | identical consecutive words; repeated word pair within 6 words |
| Diversity | MTLD (≥ 50 words, threshold 0.72, bidirectional) or root type-token ratio (< 50 words) |
| Sophistication | share of content words outside a ~900 most-frequent-word list |
| ASR clarity | duration-weighted mean of exp(avg_logprob) of Whisper segments |
In multi-turn sessions metrics are computed per answer and combined (gaps between turns are not pauses).

## Scores (0–100)
| Score | Formula |
|---|---|
| **Grammar** | 50% × error-free-sentence ratio + 50% × (100 − 10 × verified errors per 100 words). Errors count only if the AI's quoted words appear in the transcript. Omitted (not guessed) when AI is unavailable. |
| **Vocabulary** | 60% × diversity [MTLD 20→90 or root-TTR 2.5→7.5] + 40% × lin(sophistication, 0, 25%) − 3 per overused word (max −15) |
| **Fluency** | 35% × lin(MLR, 2, 10) + 25% × (100 − 15 × long pauses/min) + 25% × (100 − 12 × fillers/100 words) + 15% × rate score. Rate score = 100 for 110–170 wpm, falling to 0 at 50 and 230 wpm – so speaking faster never increases fluency beyond the natural band. Without timings (browser recogniser/typed): 60% filler + 40% rate, labelled *partial*. |
| **Pronunciation (approximate)** | lin(ASR clarity, 0.5, 0.95); for read-aloud averaged with word accuracy (Levenshtein alignment). Not phoneme-level. |
| **Sentence construction** | 60% × error-free-sentence ratio + 40% × complexity [50% sentence-length score (4→12 words, penalty above 25) + 50% lin(subordinate markers per sentence, 0, 0.6)] |
| **Speaking consistency** | 50% × (100 − 60 × run-length CV) + 50% × lin(phonation ratio, 0.4, 0.85). Needs timings. |
| **Relevance** | AI rubric 0–4 × 25 (labelled “AI rubric”). |
| **Overall** | weighted mean of available scores: grammar 25%, fluency 20%, vocabulary 15%, construction 15%, relevance 15%, pronunciation 10% (weights re-normalised when a score is missing). |
| **Improvement** | current score − mean of the last 5 sessions of the same type. |

## Delivery indicators (not a “confidence score”)
Fillers per 100 words (≤ 3 good), long pauses per minute (≤ 2), restarts/repeats (≤ 2), hedging phrases (≤ 3), words spoken (≥ 40).
The app never claims to measure psychological confidence.

## Other
* **Grammar mastery** = accuracy of the last 20 exercise/sentence answers − 5 points per unresolved real-conversation mistake of that category in 14 days (max −30). ≥ 85% with ≥ 10 attempts = mastered (skipped in plans).
* **Adaptive difficulty** (1–5): +1 after three consecutive speaking sessions ≥ 80; −1 after three ≤ 50.
* **CEFR estimate**: composite of speaking 40%, grammar ladder 25% (highest level with ≥ 60% and all lower levels passed), vocabulary yes/no test 20% (hit rate − false-alarm rate on pseudo-words, weighted by level), listening 15%. Needs ≥ 3 parts. Bands: <20 A1, <35 A2, <55 B1, <72 B2, <87 C1, else C2 (C2 also requires speaking and grammar ≥ 85). Informal only.
* **Interview rubric**: AI 0–4 per dimension (grammar, clarity, relevance, structure, completeness, professional) shown separately from the measured scores.
