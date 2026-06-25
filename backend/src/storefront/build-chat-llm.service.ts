import { Injectable, Logger } from '@nestjs/common';

import { GroqChatService } from './groq-chat.service';
import { GeminiChatService } from './gemini-chat.service';
import { matcherBusy, matcherNotConfigured } from './part-matcher';
import type { ChatCompleter, ChatMessage } from './chat-completer';

/**
 * Chat-completion facade BuildChatService talks to — the conversational twin of
 * BuildMatcherService. Tries each configured provider in priority order (Groq
 * first, Gemini as backup) and returns the first non-empty completion. A provider
 * that errors is logged and skipped; only when EVERY provider errors does it
 * surface the friendly 503 the frontend already knows how to render.
 */
@Injectable()
export class BuildChatLlmService {
  private readonly logger = new Logger(BuildChatLlmService.name);

  // Order = priority. Groq (free, fast) leads; Gemini covers Groq outages.
  private readonly providers: ChatCompleter[];

  constructor(groq: GroqChatService, gemini: GeminiChatService) {
    this.providers = [groq, gemini];
  }

  /** True when at least one provider has a key configured. */
  get enabled(): boolean {
    return this.providers.some((p) => p.enabled);
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const active = this.providers.filter((p) => p.enabled);
    if (active.length === 0) throw matcherNotConfigured();

    let lastErr: unknown;
    for (const provider of active) {
      try {
        const out = await provider.complete(messages);
        if (out && out.trim()) return out;
        this.logger.warn(
          `${provider.name} chat returned empty; trying fallback`,
        );
      } catch (err) {
        lastErr = err;
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `${provider.name} chat failed (${reason}); trying fallback`,
        );
      }
    }

    throw matcherBusy(lastErr);
  }
}
