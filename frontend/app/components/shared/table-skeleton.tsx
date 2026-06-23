/**
 * circuit.rocks admin — TableSkeleton
 *
 * Loading affordance for tables: a brutalist bordered frame with a fake header
 * row and `rows` × `cols` shimmer cells. The shimmer uses Tailwind's
 * `animate-pulse`, which is automatically suppressed by the
 * `motion-reduce:animate-none` variant for users who prefer reduced motion.
 */
export function TableSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  const colKeys = Array.from({ length: cols }, (_, i) => i);
  const rowKeys = Array.from({ length: rows }, (_, i) => i);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading data"
      className="overflow-hidden border-2 border-line shadow-brutal"
    >
      {/* Header */}
      <div
        className="grid gap-px border-b-2 border-line bg-carbon"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {colKeys.map((c) => (
          <div key={c} className="px-3 py-3">
            <div className="h-3 w-2/3 animate-pulse bg-dark-meta/50 motion-reduce:animate-none" />
          </div>
        ))}
      </div>

      {/* Body */}
      <div>
        {rowKeys.map((r) => (
          <div
            key={r}
            className="grid gap-px border-b-2 border-line last:border-b-0 odd:bg-paper even:bg-paper-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {colKeys.map((c) => (
              <div key={c} className="px-3 py-4">
                <div
                  className="h-3.5 animate-pulse bg-line/15 motion-reduce:animate-none"
                  style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
