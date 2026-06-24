import { Injectable } from '@nestjs/common';

import {
  backoffDelay,
  buildPrompt,
  isRetryableStatus,
  matcherBusy,
  matcherNotConfigured,
  MAX_ATTEMPTS,
  normalizeMatches,
  sleep,
  type CatalogEntry,
  type MatchedLine,
  type PartMatcher,
} from './part-matcher';

/**
 * Groq-backed part matcher — the PRIMARY provider (Gemini is the fallback). Groq
 * exposes an OpenAI-compatible chat-completions endpoint, so this hits it with a
 * plain `fetch` (no SDK dependency). Requires `GROQ_API_KEY`; absent → `enabled`
 * is false and BuildMatcherService skips straight to Gemini.
 *
 * Free tier default: `llama-3.3-70b-versatile` (override with `GROQ_MODEL`). We
 * use JSON-object response mode — Groq's broadly-supported structured mode — and
 * pin the exact `{ "lines": [...] }` envelope in the prompt; `normalizeMatches`
 * then validates every id against the catalog, same as the Gemini path.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 30_000;

/** Pins the JSON envelope for json-object mode (Groq has no native array schema). */
const OUTPUT_NOTE =
  'Return ONLY a JSON object of the exact form {"lines": [ <one item per ' +
  'component, with the fields above> ]}. No prose, no markdown — just the object.';

const SYSTEM_PROMPT =
  'You are a precise electronics parts-matching engine. You only ever reference ' +
  'catalog ids given to you, and you always reply with strictly valid JSON.';

interface GroqChatResponse {
  choices?: { message?: { content?: string } }[];
}

@Injectable()
export class GroqMatcherService implements PartMatcher {
  readonly name = 'groq';

  private readonly apiKey = process.env.GROQ_API_KEY ?? null;
  private readonly model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;

  /** Whether a key is configured (the provider is otherwise skipped). */
  get enabled(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Resolve free-text input against the catalog. Returns validated lines; a
   * hallucinated id can never leak downstream (see `normalizeMatches`).
   */
  async match(text: string, catalog: CatalogEntry[]): Promise<MatchedLine[]> {
    if (!this.apiKey) throw matcherNotConfigured();

    const content = await this.completeWithRetry(text, catalog);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }
    return normalizeMatches(parsed, catalog);
  }

  /**
   * The single completion call, with exponential-backoff retry on transient Groq
   * failures (429 rate-limited / 5xx) and network/timeout errors. Once retries
   * are spent — or on a non-retryable HTTP error — it surfaces the structured 503
   * the frontend expects (the facade catches it and tries Gemini next).
   */
  private async completeWithRetry(
    text: string,
    catalog: CatalogEntry[],
  ): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(text, catalog, OUTPUT_NOTE) },
      ],
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
          return json.choices?.[0]?.message?.content ?? '{"lines":[]}';
        }

        // Non-2xx: keep the body for diagnostics, retry only transient statuses.
        lastErr = new Error(
          `Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
        if (!isRetryableStatus(res.status) || attempt >= MAX_ATTEMPTS) break;
      } catch (err) {
        // Network error / abort-timeout — transient, worth a retry.
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
