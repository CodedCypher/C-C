import { Injectable, Logger } from '@nestjs/common';

import { GroqMatcherService } from './groq-matcher.service';
import { GeminiMatcherService } from './gemini-matcher.service';
import {
  matcherBusy,
  matcherNotConfigured,
  matcherNoVision,
  type CatalogEntry,
  type ImageInput,
  type MatchedLine,
  type PartMatcher,
} from './part-matcher';

export type { CatalogEntry, ImageInput, MatchedLine } from './part-matcher';

/**
 * The build-matcher facade StorefrontService talks to. It tries each configured
 * provider in priority order — **Groq first, Gemini as backup** — and returns
 * the first non-empty result. A provider that errors (rate-limited, overloaded,
 * timed out) is logged and skipped to the next; only when EVERY provider errors
 * does it surface the friendly 503. A clean empty result from any provider is
 * trusted (upstream turns it into the "couldn't find parts" 400), so a healthy
 * Groq miss won't needlessly burn the Gemini quota.
 */
@Injectable()
export class BuildMatcherService {
  private readonly logger = new Logger(BuildMatcherService.name);

  // Order = priority. Groq (free, fast) leads; Gemini covers Groq outages.
  private readonly providers: PartMatcher[];

  constructor(groq: GroqMatcherService, gemini: GeminiMatcherService) {
    this.providers = [groq, gemini];
  }

  /** True when at least one provider has a key configured. */
  get enabled(): boolean {
    return this.providers.some((p) => p.enabled);
  }

  async match(text: string, catalog: CatalogEntry[]): Promise<MatchedLine[]> {
    const active = this.providers.filter((p) => p.enabled);
    if (active.length === 0) throw matcherNotConfigured();

    let lastErr: unknown;
    let sawCleanResult = false;
    for (const provider of active) {
      try {
        const lines = await provider.match(text, catalog);
        if (lines.length > 0) return lines;
        // Provider answered but found nothing — trust it, don't 503.
        sawCleanResult = true;
        this.logger.warn(
          `${provider.name} matcher returned no lines${
            provider === active[active.length - 1] ? '' : '; trying fallback'
          }`,
        );
      } catch (err) {
        lastErr = err;
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `${provider.name} matcher failed (${reason}); trying fallback`,
        );
      }
    }

    // At least one provider answered cleanly (just empty) → not an outage.
    if (sawCleanResult) return [];
    // Every provider errored → the FE-facing "busy" 503.
    throw matcherBusy(lastErr);
  }

  /**
   * Photo door — same fan-over semantics as {@link match}, but only over
   * vision-capable providers (those exposing `matchImage`, i.e. Gemini). With
   * none configured it's a feature-unavailable 503, not an outage.
   */
  async matchImage(
    image: ImageInput,
    catalog: CatalogEntry[],
  ): Promise<MatchedLine[]> {
    const vision = this.providers.filter(
      (p) => p.enabled && typeof p.matchImage === 'function',
    );
    if (vision.length === 0) throw matcherNoVision();

    let lastErr: unknown;
    let sawCleanResult = false;
    for (const provider of vision) {
      try {
        const lines = await provider.matchImage!(image, catalog);
        if (lines.length > 0) return lines;
        sawCleanResult = true;
      } catch (err) {
        lastErr = err;
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `${provider.name} image matcher failed (${reason}); trying fallback`,
        );
      }
    }

    if (sawCleanResult) return [];
    throw matcherBusy(lastErr);
  }
}
