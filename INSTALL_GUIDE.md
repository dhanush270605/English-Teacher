# Installation guide – Vivo V27

The APK could not be compiled inside the environment where this app was built (no access to Google's
Android SDK/Maven servers), so you build it once, for free, with **one** of these routes. Both produce the
same app. Route A needs no software on your laptop.

---

## Route A – GitHub Actions (recommended, nothing to install)

1. Create a free account at github.com (if you don't have one) and create a **new private repository**,
   e.g. `english-mastery` (no README).
2. Upload the project (≈140 files). Easiest: install **GitHub Desktop** (free) → File → Add local repository →
   choose the `English Mastery App/source` folder → “create a repository” → Publish (keep it private).
   *Browser alternative:* the web uploader takes max 100 files per commit, so upload in two commits – first
   everything except the `android` folder, then the `android` folder. Make sure the hidden `.github` folder is
   included (Windows Explorer: View → Show → Hidden items).
   *(Git CLI: `git init && git add . && git commit -m init && git branch -M main && git remote add origin <url> && git push -u origin main`.)*
3. Open the **Actions** tab → “Build Android APK” runs automatically (≈ 8–12 minutes).
   If it doesn't start, click it → **Run workflow**.
4. When it shows a green tick, open the run → **Artifacts** → download `EnglishMastery-apk` (a .zip containing
   `EnglishMastery-<n>.apk`).

**Keep updates installable:** the first build signs with a temporary key. To install future builds *over* the
old one (keeping your data), create a permanent key once: run `scripts/make-keystore.sh` (Git Bash/WSL with Java),
then add the 4 secrets it prints in repo **Settings → Secrets and variables → Actions**. Without this, each new
build must be installed after uninstalling the old app (export your data first: Profile → Privacy → Export).

## Route B – Android Studio on your Windows laptop

1. Install **Node.js 22 LTS** (nodejs.org) and **Android Studio** (developer.android.com/studio) – both free.
   In Android Studio's first-run wizard accept the default SDK.
2. In a terminal inside the `source` folder:
   ```
   npm install
   npm run build
   npx cap sync android
   npx cap open android
   ```
3. Android Studio opens the project. Wait for Gradle sync, then **Build → Generate Signed App Bundle / APK →
   APK** → create a new key store (save it and its password safely) → **release** → Finish.
   The APK appears in `android/app/release/app-release.apk`.
   (Quick test only: **Build → Build APK(s)** creates a debug APK in `android/app/build/outputs/apk/debug/`.)

---

## Automatic updates
From build 3 onward the app updates itself: on every launch it checks the latest GitHub release, downloads the new
version in the background and switches to it the next time you open the app (Profile → About & limitations shows the
version and has **Check for updates / Restart now**). Your data is kept. Only changes to native Android parts
(new permissions or plugins) need a new APK – the app will say so in the release notes.

## Install on the Vivo V27

1. Copy the APK to the phone: USB cable (choose “File transfer”) into `Download/`, or send it to yourself on
   Google Drive / Telegram / email and download it on the phone.
2. Open **Files** (or the downloaded file) → tap `EnglishMastery-….apk`.
3. If asked, allow **Install unknown apps** for that app (Files/Chrome/Drive) → back → **Install**.
   Vivo may show a security scan prompt – choose **Install** / **Continue installing**.
4. Open **English Mastery**.

## Permissions to grant
| Permission | How |
|---|---|
| **Microphone** | Asked the first time you tap the mic → **While using the app**. If you denied it: Settings → Apps → English Mastery → Permissions → Microphone → Allow only while using. |
| **Notifications** | Asked during setup → **Allow**. Or Settings → Notifications & status bar → App notifications → English Mastery → on (allow lock screen and banners). |
| **Alarms & reminders** (on-time reminders) | In the app: Profile → Reminders → **Allow exact alarms**. Or Settings → Apps → Special access → Alarms & reminders → English Mastery → allow. |
| **Background / battery** (Vivo) | Settings → Battery → Background power consumption management → English Mastery → **Allow**. |
| **Autostart** (Vivo) | Settings → Apps & permissions → Permission management → **Autostart** → English Mastery on (or i Manager → App manager → Autostart). |
| **Lock in recents** | Open recent apps, pull down on English Mastery (lock icon) so cleanup doesn't kill it. |

Menu names vary slightly between Funtouch OS/OriginOS versions. After setup, restart the phone once, open the app,
then Profile → Reminders → **Send test in 10s** and lock the screen to confirm delivery.

## Free API keys (needed for the AI teacher, speech-to-text and feedback)
Keys are typed into the app and stored only on your phone – never in the APK, code, or these docs.

1. **Groq (recommended – covers voice and teacher):** on the phone or laptop open `console.groq.com/keys`,
   sign in (Google login works), **Create API Key**, copy it (starts with `gsk_`).
2. **Google Gemini (optional fallback + lets the AI look at picture-challenge photos):** `aistudio.google.com/apikey`
   → **Create API key** (starts with `AIza`).
3. In the app: **Profile → AI keys & usage** → paste → **Save** → **Test & load models**.

Free tiers have daily limits (see `docs/API_AND_RESOURCE_RESEARCH.md`); the app shows today's usage and switches
provider when one is rate-limited. If a default model name is ever retired, use **Test & load models** and pick a
current one from the list. Without any key the app still works for grammar lessons, exercises, flashcards, timer,
reminders and typed practice, but not for AI feedback or voice transcription.

## Using it as a PWA instead (no APK)
Host the `dist/` folder on any free static host with HTTPS (e.g. GitHub Pages, Netlify, Cloudflare Pages), open it in
Chrome on the phone → ⋮ → **Add to Home screen / Install app**. Limitations: reminders do **not** fire when the app is
closed (Android browsers can't schedule local notifications), and Groq calls from a browser depend on Groq allowing
cross-origin requests – if voice fails in the PWA, use the APK (which uses native HTTP) or a Gemini key.
