import { API_BASE_URL, DEMO_MODE } from '../config';
import { demoReply } from './demo';
import type { ChatMessage, Lesson } from '../types';

export type ChatResponse = { reply: string };

export type ChatResult = {
  reply: string;
  demo: boolean; // true if the answer came from the offline demo tutor
};

/**
 * Returns the tutor's reply (always in Tajik).
 *
 * Order of resolution:
 *  1. If DEMO_MODE is on, answer entirely offline (no network).
 *  2. Otherwise call the backend (Claude API).
 *  3. If the backend is unreachable or errors, fall back to the demo tutor so
 *     the app is always usable.
 */
export async function sendChat(
  messages: ChatMessage[],
  lesson?: Lesson | null
): Promise<ChatResult> {
  if (DEMO_MODE) {
    return { reply: demoReply(messages, lesson), demo: true };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        lesson: lesson ? { title: lesson.title, words: lesson.words } : undefined,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as ChatResponse;
    if (!data.reply) throw new Error('empty reply');
    return { reply: data.reply, demo: false };
  } catch {
    // Network/backend problem — degrade gracefully to the offline demo tutor.
    return { reply: demoReply(messages, lesson), demo: true };
  }
}
