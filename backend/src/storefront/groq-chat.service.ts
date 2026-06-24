import { Injectable } from '@nestjs/common';

import {
  backoffDelay,
  isRetryableStatus,
  matcherBusy,
  matcherNotConfigured,
  MAX_ATTEMPTS,
  sleep,
} from './part-matcher';
import type { ChatCompleter, ChatMessage } from './chat-completer';

/**
 * Groq-backed chat completer — the PRIMARY conversational provider (Gemini is the
 * fallback). Mirrors GroqMatcherService's plain-`fetch` call to the OpenAI-compatible
 * chat-completions endpoint, but generic over an arbitrary message list and used for
 * the build-assistant conversation rather than one-shot matching. Requires
 * `GROQ_API_KEY`; absent → `enabled` is false and BuildChatLlmService skips to Gemini.
 *
 * Model defaults to `GROQ_CHAT_MODEL` → `GROQ_MODEL` → `llama-3.3-70b-versatile`.
 * Uses JSON-object response mode; the caller pins the `{reply,resolve,partsList}`
 * envelope in the system prompt.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 30_000;

interface GroqChatResponse {
  choices?: { message?: { content?: string } }[];
}

@Injectable()
export class GroqChatService implements ChatCompleter {
  readonly name = 'groq';

  private readonly apiKey = process.env.GROQ_API_KEY ?? null;
  private readonly model =
    process.env.GROQ_CHAT_MODEL ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL;

  get enabled(): boolean {
    return this.apiKey !== null;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) throw matcherNotConfigured();

    const body = JSON.stringify({
      model: this.model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages,
    });

    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
          signal: controller.signal,
        });

        if (res.ok) {
          const json = (await res.json()) as GroqChatResponse;
          return json.choices?.[0]?.message?.content ?? '';
        }

        lastErr = new Error(
          `Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
        if (!isRetryableStatus(res.status) || attempt >= MAX_ATTEMPTS) break;
      } catch (err) {
        lastErr = err;
        if (attempt >= MAX_ATTEMPTS) break;
      } finally {
        clearTimeout(timer);
      }
      await sleep(backoffDelay(attempt));
    }

    throw matcherBusy(lastErr);
  }
}
