# Known limitations & what still needs real-device verification

## Not verified in the build environment (be aware)
1. **APK compilation.** Google's Android SDK/Maven servers were unreachable, so `gradlew assembleRelease` has not been run. The Android project is the unmodified Capacitor 8 template plus manifest permissions, icons, a notification icon and an optional signing block. Build it with GitHub Actions or Android Studio (INSTALL_GUIDE.md). If the first CI run fails, the log will show the exact Gradle error.
2. **Real API calls.** Groq/Gemini/Wikimedia were blocked from the build sandbox; all request/response handling was tested against mocks that follow the documented formats. First real use happens on your phone. If a default model id has been retired, use Profile → AI keys → *Test & load models* and pick a listed one.
3. **Physical Vivo V27.** Not connected. Tested only in a phone-sized Chromium.

## Device checklist (please try once after installing)
- [ ] Mic permission prompt appears; recording works; “Play my voice” plays back.
- [ ] Teacher voice speaks (install UK voice data if British accent is silent).
- [ ] A conversation turn with a Groq key returns a reply (voice → text → reply).
- [ ] Picture challenge loads a photo.
- [ ] Notifications: “Send test in 10s”, lock the phone – it arrives. Restart phone, open app once, check reminders still listed.
- [ ] With battery settings from the Vivo guide, a scheduled reminder arrives with the app closed.
- [ ] Back button navigates back / exits from Home.

## Inherent limitations
- **Speech recognition is not perfect** (accent, noise, mic, network). Edit the text before sending; unclear audio is flagged, not scored.
- **Whisper may remove some fillers** despite the disfluent prompt → filler counts can be slightly low.
- **Pronunciation is approximate**, not phoneme-level.
- **Confidence** is not measured; only observable delivery signals.
- **CEFR** is an informal estimate.
- **Free tiers** have daily limits and terms can change; heavy days may hit limits (the app falls back and shows usage).
- **Privacy:** audio and text you send go to Groq/Google for processing. Google's free tier may use data to improve products.
- **Notifications** are not guaranteed on aggressive battery settings; browser/PWA cannot fire reminders when closed.
- **Groq from the browser (PWA):** depends on Groq allowing cross-origin requests; the APK uses native HTTP and is unaffected.
- Real-time transcription while speaking is shown only with the browser recogniser; Whisper returns text after you stop.
- Requested `plugins` folder was not present in the provided project directory, so nothing from it was used.
