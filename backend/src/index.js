import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';

import { TUTOR_SYSTEM_PROMPT, lessonContext } from './tutorPrompt.js';
import { demoReply } from './demo.js';

const PORT = process.env.PORT || 8787;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim());

// If no API key is set, run in DEMO mode: serve pre-written Tajik answers
// instead of crashing. Set ANTHROPIC_API_KEY to enable the live Claude tutor.
const DEMO_MODE = !process.env.ANTHROPIC_API_KEY;
if (DEMO_MODE) {
  console.warn(
    '[warn] ANTHROPIC_API_KEY not set — running in DEMO mode (pre-written answers).'
  );
}

const anthropic = DEMO_MODE
  ? null
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
  })
);

// Basic abuse protection: 30 requests / minute / IP.
app.use(
  '/api/',
  rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: CLAUDE_MODEL, demo: DEMO_MODE });
});

/**
 * POST /api/chat
 * body: {
 *   messages: [{ role: 'user' | 'assistant', content: string }],
 *   lesson?: { title, words: [{ hanzi, pinyin, tj }] }
 * }
 * Returns: { reply: string }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, lesson } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] is required' });
    }

    // No API key configured — answer from the offline demo tutor.
    if (DEMO_MODE) {
      return res.json({ reply: demoReply(messages, lesson), demo: true });
    }

    // Keep only the last 20 turns and sanitise shape.
    const trimmed = messages
      .slice(-20)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 4000) }));

    const system = TUTOR_SYSTEM_PROMPT + lessonContext(lesson);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      messages: trimmed,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ reply });
  } catch (err) {
    console.error('[/api/chat] error:', err?.message || err);
    res.status(500).json({ error: 'Хатои сервер. Дубора кӯшиш кунед.' });
  }
});

app.listen(PORT, () => {
  console.log(`Xitoi tutor backend listening on http://localhost:${PORT}`);
  console.log(`Model: ${CLAUDE_MODEL}`);
});
