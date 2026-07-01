import { API_BASE_URL } from '../config';
import type { ChatMessage, Lesson } from '../types';

export type ChatResponse = { reply: string };

/**
 * Sends the conversation to the backend, which talks to the Claude API and
 * returns the tutor's reply (always in Tajik).
 */
export async function sendChat(
  messages: ChatMessage[],
  lesson?: Lesson | null
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      lesson: lesson
        ? {
            title: lesson.title,
            words: lesson.words,
          }
        : undefined,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as ChatResponse;
  return data.reply;
}
