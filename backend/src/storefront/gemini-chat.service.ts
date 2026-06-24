import { Injectable } from '@nestjs/common';
import { GoogleGenAI, type Content } from '@google/genai';

import {
  backoffDelay,
  isRetryableError,
  matcherBusy,
  matcherNotConfigured,
  MAX_ATTEMPTS,
  sleep,
} from './part-matcher';
import type { ChatCompleter, ChatMessage } from './chat-completer';

/**
 * Gemini-backed chat completer — the BACKUP conversational provider (Groq is
 * primary). Used only when Groq is unconfigured or its retries are exhausted, via
 * BuildChatLlmService. Mirrors GeminiMatcherService's SDK call + retry, mapping our
 * provider-neutral `ChatMessage[]` onto Gemini's shape: `system` turns collapse
 * into `systemInstruction`, `assistant` → role `model`, everything else → `user`.
 * Requires `GEMINI_API_KEY`; absent → `enabled` is false and the facade skips it.
 */

const MODEL = 'gemini-2.5-flash';

@Injectable()
export class GeminiChatService implements ChatCompleter {
  readonly name = 'gemini';

  private readonly client = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

  get enabled(): boolean {
    return this.client !== null;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const client = this.client;
    if (!client) throw matcherNotConfigured();

    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents: Content[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await client.models.generateContent({
          model: MODEL,
          contents,
          config: {
            systemInstruction: system || undefined,
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
        return res.text ?? '';
      } catch (err) {
        lastErr = err;
        if (attempt >= MAX_ATTEMPTS || !isRetryableError(err)) break;
        await sleep(backoffDelay(attempt));
      }
    }

    throw matcherBusy(lastErr);
  }
}
