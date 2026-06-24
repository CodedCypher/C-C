/**
 * Conversational-completion counterpart to the part-matcher abstraction. The
 * matcher (`PartMatcher`) resolves a parts list to catalog ids; a `ChatCompleter`
 * holds a back-and-forth conversation. Both reuse the SAME transient-failure
 * tuning + structured errors from `part-matcher.ts`, and both are fanned over
 * Groq-first / Gemini-fallback by a facade (BuildMatcherService / BuildChatLlmService).
 */

/** One conversation turn handed to a chat provider. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** The shape every chat provider satisfies (lets the facade fan over them). */
export interface ChatCompleter {
  /** Human label for logs ("groq" / "gemini"). */
  readonly name: string;
  /** Whether the provider's key is configured (otherwise it's skipped). */
  readonly enabled: boolean;
  /**
   * Run one completion over the conversation and return the raw model text. The
   * caller pins a strict JSON envelope in the system prompt, so providers request
   * JSON-object output; parsing/validation happens upstream in BuildChatService.
   */
  complete(messages: ChatMessage[]): Promise<string>;
}
