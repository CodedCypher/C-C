/**
 * circuit.rocks — BrandTile
 * Bordered tile: brand name + mono product count. Hard-shadow press on hover.
 */
export function BrandTile({
  brand,
  count,
  href = "#",
}: {
  brand: string;
  count: number;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="cr-press flex min-h-[120px] flex-col justify-between gap-[18px] border-2 border-line bg-paper p-4 no-underline shadow-brutal hover:shadow-press active:shadow-none"
    >
      <span className="font-sans text-xl font-bold tracking-[-0.01em] text-ink">
        {brand}
      </span>
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.06em] text-smoke">
        <span aria-hidden>→</span>
        {count} Products
      </span>
    </a>
  );
}
