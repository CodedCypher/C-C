/**
 * circuit.rocks — AnnouncementBar
 * Full-width carbon strip, paper mono text, last item rendered in signal yellow.
 */
const DEFAULT_ITEMS = [
  "Free shipping above ₱2,000",
  "Manila same-day cutoff 4PM",
  "School / class POs welcome →",
];

export function AnnouncementBar({
  items = DEFAULT_ITEMS,
}: {
  items?: string[];
}) {
  return (
    <div className="overflow-hidden border-b-2 border-line bg-carbon font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-paper">
      <div className="flex flex-wrap items-center justify-center px-4 py-[9px] text-center">
        {items.map((txt, i) => {
          const isCta = i === items.length - 1;
          return (
            <span key={i} className="inline-flex items-center">
              <span className={isCta ? "font-bold text-signal" : "text-paper"}>
                {txt}
              </span>
              {i < items.length - 1 && (
                <span aria-hidden className="px-3 text-dark-meta">
                  ·
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
