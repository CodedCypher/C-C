import { ServiceUnavailableException } from '@nestjs/common';
import { fieldError } from '../common/structured-error';

/**
 * Provider-agnostic core of the build matcher. The actual LLM call lives in the
 * per-provider services (Groq primary, Gemini fallback); everything they SHARE —
 * the prompt, the output validation, and the transient-failure tuning — lives
 * here so the two providers can never drift apart in how they parse or guard a
 * response.
 *
 * The model only ever returns variant **ids + confidence + a note**, never
 * prices or stock — those stay DB truth, re-resolved by StorefrontService.
 */

/** A compact catalog row handed to the model as the match universe. */
export interface CatalogEntry {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  availability: 'IN_STOCK' | 'LOW' | 'OUT';
}

/** One detected line from the maker's input, matched (or not) to a variant. */
export interface MatchedLine {
  rawLabel: string;
  qty: number;
  matchedVariantId: string | null;
  confidence: number; // 0..1
  note: string | null;
  alternativeVariantIds: string[]; // ranked functional equivalents (catalog ids)
}

/** A base64-encoded image handed to a vision-capable provider. */
export interface ImageInput {
  /** Base64 bytes (no `data:` prefix). */
  data: string;
  /** e.g. 'image/jpeg', 'image/png', 'image/webp'. */
  mimeType: string;
}

/** The shape every provider is expected to satisfy (lets the facade fan over them). */
export interface PartMatcher {
  /** Human label for logs ("groq" / "gemini"). */
  readonly name: string;
  /** Whether the provider's key is configured (otherwise it's skipped). */
  readonly enabled: boolean;
  match(text: string, catalog: CatalogEntry[]): Promise<MatchedLine[]>;
  /**
   * Vision door: extract + match parts from a photo (schematic, breadboard, or
   * printed/handwritten parts list). Only vision-capable providers (Gemini)
   * implement it; the facade routes images to whoever defines it.
   */
  matchImage?(
    image: ImageInput,
    catalog: CatalogEntry[],
  ): Promise<MatchedLine[]>;
}

/**
 * The `text` slot handed to `buildPrompt` when the real input is the attached
 * photo — tells the model to read the components out of the image instead.
 */
export const IMAGE_INPUT_NOTE =
  'The maker input is the ATTACHED IMAGE — a photo of a schematic, breadboard, ' +
  'wiring diagram, or printed/handwritten parts list. Read every electronic ' +
  'component visible in it and match each to the catalog.';

/* ------------------------------------------------------------------ *
 * Transient-failure retry tuning (shared by every provider)
 * ------------------------------------------------------------------ */

export const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

/** Statuses worth a retry: overloaded (503), rate-limited (429), gateways, 500. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True for an HTTP status a backoff retry might recover from. */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/** True for SDK errors that carry a retryable `status` (Gemini-style errors). */
export function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return typeof status === 'number' && isRetryableStatus(status);
}

/** Exponential backoff (500ms, 1s, 2s …) with jitter to avoid thundering retries. */
export function backoffDelay(attempt: number): number {
  return BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

/* ------------------------------------------------------------------ *
 * Structured errors (mirror the rest of the API's contract)
 * ------------------------------------------------------------------ */

/** No provider has a key configured → the feature is unavailable, not broken. */
export function matcherNotConfigured(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    fieldError(
      'text',
      'Build matching is not configured (set GROQ_API_KEY or GEMINI_API_KEY).',
      503,
      'ServiceUnavailable',
    ),
  );
}

/** Photo door asked for, but no vision-capable provider is configured. */
export function matcherNoVision(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    fieldError(
      'image',
      'Photo matching is not available right now — set GEMINI_API_KEY, or paste your parts list as text instead.',
      503,
      'ServiceUnavailable',
    ),
  );
}

/** Every provider's retries are spent → the same friendly 503 the FE expects. */
export function matcherBusy(cause?: unknown): ServiceUnavailableException {
  return new ServiceUnavailableException(
    fieldError(
      'text',
      'The build matcher is busy right now — please try again in a moment.',
      503,
      'ServiceUnavailable',
    ),
    { cause: cause instanceof Error ? cause : undefined },
  );
}

/* ------------------------------------------------------------------ *
 * Prompt
 * ------------------------------------------------------------------ */

/**
 * Build the matcher prompt. `outputNote` lets a provider that lacks a native
 * response schema (e.g. Groq's JSON-object mode) pin the exact JSON envelope it
 * must emit; Gemini omits it because its `responseSchema` already enforces shape.
 */
export function buildPrompt(
  text: string,
  catalog: CatalogEntry[],
  outputNote?: string,
): string {
  const rows = catalog
    .map(
      (c) =>
        `${c.id}\t${c.sku}\t${c.name}\t${c.brand ?? '-'}\t${c.price.toFixed(2)}\t${c.availability}`,
    )
    .join('\n');

  return [
    'You match a maker’s parts list to an electronics store catalog.',
    '',
    'For every distinct component the maker needs, output one item with:',
    '- rawLabel: how the maker referred to the part (verbatim, short).',
    '- qty: integer quantity needed (default 1 when unspecified).',
    '- matchedVariantId: the single best catalog `id` from the list below, or',
    '  null when nothing in the catalog is a reasonable fit.',
    '- confidence: 0..1 certainty the matched variant is what they need.',
    '- note: short reason ONLY when you substituted a close-but-not-exact part,',
    '  or when matchedVariantId is null (suggest what to search for). Else null.',
    '- alternativeVariantIds: up to 3 catalog `id`s of functional equivalents,',
    '  ranked best-first, PREFERRING ones marked IN_STOCK. [] when none fit.',
    '',
    'Rules:',
    '- matchedVariantId MUST be an `id` copied exactly from the catalog, or null.',
    '  Never invent an id. Never output a price or stock figure.',
    '- Merge obvious duplicates into one line with summed qty.',
    '- Generic passives stated only by value (e.g. "10kΩ resistor", "0.1µF cap")',
    '  with no catalog equivalent → matchedVariantId null, explain in note.',
    '- Prefer the closest functional equivalent; if you swap brand/model, say so',
    '  in note and lower confidence accordingly.',
    '- Use the stock column: when two matches are equally good, pick the IN_STOCK',
    '  one as matchedVariantId. ALWAYS fill alternativeVariantIds when the best',
    '  match is OUT or LOW, so the shopper has an in-stock swap to fall back on.',
    ...(outputNote ? ['', outputNote] : []),
    '',
    'CATALOG  (tab-separated: id, sku, name, brand, price, stock):',
    rows,
    '',
    'MAKER INPUT:',
    text,
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Response validation
 * ------------------------------------------------------------------ */

/**
 * Coerce a parsed model response (a bare array, or `{ lines: [...] }`) into
 * validated lines. Any `matchedVariantId` not present in `catalog` is forced to
 * null and every alternative id is checked against the catalog too, so a
 * hallucinated id can never leak downstream — regardless of which provider
 * produced it.
 */
export function normalizeMatches(
  parsed: unknown,
  catalog: CatalogEntry[],
): MatchedLine[] {
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { lines?: unknown })?.lines)
      ? (parsed as { lines: unknown[] }).lines
      : [];

  const validIds = new Set(catalog.map((c) => c.id));
  const out: MatchedLine[] = [];
  for (const r of arr) {
    if (typeof r !== 'object' || r === null) continue;
    const row = r as Record<string, unknown>;
    const rawLabel =
      typeof row.rawLabel === 'string' ? row.rawLabel.trim() : '';
    if (!rawLabel) continue;

    const rawId =
      typeof row.matchedVariantId === 'string' ? row.matchedVariantId : null;
    const matchedVariantId = rawId && validIds.has(rawId) ? rawId : null;

    const qtyNum = Number(row.qty);
    const qty = Number.isFinite(qtyNum) ? Math.max(1, Math.round(qtyNum)) : 1;

    const confNum = Number(row.confidence);
    const confidence = Number.isFinite(confNum)
      ? Math.min(1, Math.max(0, confNum))
      : 0;

    const note =
      typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null;

    // Validated, deduped functional equivalents — known ids only, never the
    // primary match itself (a hallucinated id can't leak downstream).
    const altRaw = Array.isArray(row.alternativeVariantIds)
      ? row.alternativeVariantIds
      : [];
    const alternativeVariantIds = [
      ...new Set(
        altRaw.filter(
          (id): id is string =>
            typeof id === 'string' &&
            validIds.has(id) &&
            id !== matchedVariantId,
        ),
      ),
    ].slice(0, 3);

    out.push({
      rawLabel,
      qty,
      matchedVariantId,
      confidence,
      note,
      alternativeVariantIds,
    });
  }
  return out;
}
