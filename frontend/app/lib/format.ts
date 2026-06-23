/**
 * circuit.rocks — presentation formatters.
 *
 * Moved out of the old `admin-types.ts`. Pure functions, no deps. Shared across
 * every feature's tables, cards and charts.
 *   - `peso(n)`      — ₱ currency formatter with thousands separators
 *   - `formatDate(iso)` — human date from an ISO string (or "—" for null)
 */

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a number as Philippine peso (₱) with thousands separators and no
 * decimal places (admin tables are whole-peso oriented). Non-finite values
 * render as "₱0".
 */
export function peso(n: number): string {
  if (!Number.isFinite(n)) return "₱0";
  // Intl emits "PHP" in some runtimes; force the ₱ glyph for brand consistency.
  return PESO.format(n).replace(/^PHP\s?/, "₱");
}

const DATE = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * Format an ISO timestamp as a short human date (e.g. "Jun 23, 2026").
 * Returns "—" for null / unparseable input.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE.format(d);
}
