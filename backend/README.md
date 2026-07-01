# Xitoi Tutor Backend

A small Express service that safely proxies chat requests to the Claude API for
the "Хитоӣ" (Chinese-in-Tajik) learning app. The Anthropic API key lives here on
the server only — **never** in the mobile app.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit .env and add your ANTHROPIC_API_KEY
npm run dev               # starts on http://localhost:8787
```

## Endpoints

### `GET /health`
Returns `{ ok: true, model }`.

### `POST /api/chat`
Body:
```json
{
  "messages": [{ "role": "user", "content": "Чӣ тавр «салом» гӯям?" }],
  "lesson": { "title": "Салом ва шиносоӣ", "words": [{ "hanzi": "你好", "pinyin": "nǐ hǎo", "tj": "салом" }] }
}
```
Returns `{ "reply": "..." }` — the tutor's answer, always in Tajik.

`lesson` is optional; when present the tutor focuses on that lesson's vocabulary.

## Demo mode
If `ANTHROPIC_API_KEY` is **not** set, the server starts in **demo mode** and
answers `/api/chat` with pre-written Tajik responses (`src/demo.js`) instead of
crashing. `GET /health` reports `"demo": true`. Set the key to enable the live
Claude tutor.

## Notes
- The tutor's behaviour (always answer in Tajik, teach Chinese) is defined in
  `src/tutorPrompt.js`.
- Rate limited to 30 requests/min/IP as a basic guard.
- For production, deploy anywhere that runs Node (Render, Railway, Fly.io, a VM,
  or a serverless function) and set the env vars there.
