# Хитоӣ — Омӯзиши забони хитоӣ бо ёрии зеҳни сунъӣ

**Xitoi** is a mobile app for **Google Play** that helps **native Tajik speakers
master (Mandarin) Chinese**. The entire interface and every explanation is in
**Tajik (Cyrillic)** — Chinese appears only as the language content being taught,
always paired with pinyin and a Tajik translation.

> Ин барнома барои тоҷикзабонон сохта шудааст, то забони хитоиро осон омӯзанд.
> Ҳама шарҳҳо бо забони тоҷикӣ мебошанд.

## What's inside (MVP)

| Feature | Description |
|---|---|
| 💬 **AI tutor** | Chat with an AI устод (powered by the Claude API) that answers only in Tajik, explains grammar, corrects you, and role-plays. |
| 📚 **HSK lessons** | Structured HSK 1 vocabulary units (greetings, numbers, family, time, food, verbs) with hanzi, pinyin, and Tajik meanings. |
| 🎯 **Lesson practice** | Open the tutor scoped to a specific lesson to drill its words. |
| 🧪 **Demo mode** | Works with **zero setup** — no API key, no backend. The tutor answers with pre-written Tajik responses so you can try everything immediately. |

## Demo mode (no setup required)

Out of the box the app runs in **demo mode** (`extra.demoMode: true` in
`app/app.json`): the AI tutor replies with pre-written Tajik answers, so the
whole app is usable with no API key and no running backend. A small banner in
the tutor makes this clear.

Even with demo mode off, if the backend is unreachable the app automatically
falls back to these demo answers, so it is never broken.

**To switch to the live Claude tutor:** set `extra.demoMode` to `false` in
`app/app.json`, point `extra.apiBaseUrl` at your running backend, and give the
backend an `ANTHROPIC_API_KEY`. (The backend itself also runs in demo mode if no
key is set, so `npm run dev` works before you have a key.)

## Project structure

```
.
├── app/        # Expo / React Native app (the Google Play app), fully in Tajik
└── backend/    # Small Node/Express service that proxies to the Claude API
```

## Getting started

### 1. Backend (AI service)
```bash
cd backend
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # http://localhost:8787
```

### 2. App (Expo)
```bash
cd app
npm install
npm start                 # then press 'a' for Android, or scan the QR in Expo Go
```

Point the app at your backend by editing `apiBaseUrl` in `app/app.json`
(`extra.apiBaseUrl`). On a physical device use your computer's LAN IP
(e.g. `http://192.168.1.20:8787`); on the Android emulator use
`http://10.0.2.2:8787`.

## Building for Google Play

The app is a standard Expo project, so use **EAS Build**:
```bash
npm install -g eas-cli
cd app
eas build -p android --profile production   # produces an .aab for Play Console
```
Set `extra.apiBaseUrl` to your deployed backend URL before building.

## Tech
- **App:** Expo SDK 52, React Native 0.76, React Navigation 7, TypeScript
- **Backend:** Node + Express, `@anthropic-ai/sdk` (Claude API)
- **AI:** Claude (default `claude-haiku-4-5` — fast & cheap; switch to
  `claude-sonnet-5` for higher quality)

## Roadmap ideas
- Audio pronunciation & tone trainer
- Spaced-repetition flashcards (SRS)
- Progress tracking & streaks
- More HSK levels (2–6)
- Offline lesson caching
```
