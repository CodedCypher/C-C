import { Injectable } from '@nestjs/common';
import { GoogleGenAI, Type, type ContentListUnion } from '@google/genai';

import {
  backoffDelay,
  buildPrompt,
  IMAGE_INPUT_NOTE,
  isRetryableError,
  matcherBusy,
  matcherNotConfigured,
  MAX_ATTEMPTS,
  normalizeMatches,
  sleep,
  type CatalogEntry,
  type ImageInput,
  type MatchedLine,
  type PartMatcher,
} from './part-matcher';

/**
 * Gemini-backed part matcher — the BACKUP provider (Groq is primary). Used only
 * when Groq is unconfigured or its retries are exhausted, via BuildMatcherService.
 *
 * Free tier: `gemini-2.5-flash` (also vision-capable, so a future schematic-photo
 * door reuses this exact call with an image part). Requires `GEMINI_API_KEY`;
 * absent → `enabled` is false and the facade simply skips it.
 */

export type { CatalogEntry, MatchedLine } from './part-matcher';

const MODEL = 'gemini-2.5-flash';

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      rawLabel: { type: Type.STRING },
      qty: { type: Type.INTEGER },
      matchedVariantId: { type: Type.STRING, nullable: true },
      confidence: { type: Type.NUMBER },
      note: { type: Type.STRING, nullable: true },
      alternativeVariantIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['rawLabel', 'qty', 'matchedVariantId', 'confidence'],
    propertyOrdering: [
      'rawLabel',
      'qty',
      'matchedVariantId',
      'confidence',
      'note',
      'alternativeVariantIds',
    ],
  },
};

@Injectable()
export class GeminiMatcherService implements PartMatcher {
  readonly name = 'gemini';

  private readonly client = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

  /** Whether a key is configured (the provider is otherwise skipped). */
  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Resolve free-text input against the catalog. Returns validated lines; a
   * hallucinated id can never leak downstream (see `normalizeMatches`).
   */
  async match(text: string, catalog: CatalogEntry[]): Promise<MatchedLine[]> {
    if (!this.client) throw matcherNotConfigured();
    const response = await this.generateWithRetry(buildPrompt(text, catalog));
    return this.parse(response.text, catalog);
  }

  /**
   * Vision door — extract + match parts from a photo. Sends the image inline
   * alongside the same prompt + response schema as text matching, so the result
   * goes through the identical hallucination guard (`normalizeMatches`).
   */
  async matchImage(
    image: ImageInput,
    catalog: CatalogEntry[],
  ): Promise<MatchedLine[]> {
    if (!this.client) throw matcherNotConfigured();
    const response = await this.generateWithRetry([
      {
        role: 'user',
        parts: [
          { inlineData: { data: image.data, mimeType: image.mimeType } },
          { text: buildPrompt(IMAGE_INPUT_NOTE, catalog) },
        ],
      },
    ]);
    return this.parse(response.text, catalog);
  }

  /** JSON-parse the model output and run it through the shared catalog guard. */
  private parse(
    text: string | undefined,
    catalog: CatalogEntry[],
  ): MatchedLine[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text ?? '[]');
    } catch {
      return [];
    }
    return normalizeMatches(parsed, catalog);
  }

  /**
   * The single model call, with exponential-backoff retry on transient Gemini
   * failures (503 overloaded / 429 rate-limited / 500). Once retries are spent —
   * or on a non-retryable error — it surfaces the structured 503 the frontend
   * expects instead of a raw stack trace. `contents` is either a prompt string
   * (text door) or a parts array carrying an inline image (photo door).
   */
  private async generateWithRetry(contents: ContentListUnion) {
    const client = this.client;
    if (!client) throw matcherNotConfigured();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await client.models.generateContent({
          model: MODEL,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        });
      } catch (err) {
        lastErr = err;
        if (attempt >= MAX_ATTEMPTS || !isRetryableError(err)) break;
        await sleep(backoffDelay(attempt));
      }
    }

    throw matcherBusy(lastErr);
  }
}
