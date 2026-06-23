/**
 * circuit.rocks — Footer
 * Full carbon block, paper text, mono column headers, signal link hovers.
 */
const COLUMNS = [
  { heading: "shop", links: ["Boards", "Sensors", "Kits", "Components", "Tools"] },
  {
    heading: "help",
    links: ["Shipping", "Returns", "School POs", "Track order", "Contact"],
  },
  { heading: "learn", links: ["Tutorials", "Build log", "Forum", "Events"] },
  { heading: "also-on", links: ["Shopee", "Lazada", "Facebook", "YouTube"] },
];

const SOCIAL = ["x", "fb", "ig", "yt"];

export function Footer() {
  return (
    <footer className="border-t-2 border-line bg-carbon text-paper">
      <div className="mx-auto max-w-[1320px] px-6 pb-7 pt-14">
        {/* Top: wordmark + columns */}
        <div className="grid grid-cols-[minmax(180px,1.2fr)_repeat(4,1fr)] gap-8 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1">
          <div className="flex flex-col gap-3.5">
            <span className="inline-flex items-baseline gap-0.5">
              <span className="font-sans text-[22px] font-bold tracking-[-0.02em] text-paper">
                circuit
              </span>
              <span className="inline-block size-[7px] -translate-y-px border-2 border-paper bg-signal" />
              <span className="font-mono text-[20px] font-bold text-signal">
                rocks
              </span>
            </span>
            <p className="max-w-[240px] font-mono text-xs leading-[1.7] text-dark-meta">
              Maker electronics, in Manila stock, shipped same-day. Sourced
              direct since 2015.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-signal">
                // {col.heading}
              </span>
              {col.links.map((l) => (
                <a
                  key={l}
                  href="#"
                  className="w-fit font-sans text-[0.9375rem] text-paper no-underline transition-colors hover:text-signal"
                >
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#4a4a44] pt-5">
          <span className="font-mono text-xs uppercase tracking-[0.06em] text-dark-meta">
            // © 2026 circuitrocks
          </span>
          <div className="flex gap-2.5">
            {SOCIAL.map((s) => (
              <a
                key={s}
                href="#"
                className="border-2 border-paper px-2.5 py-1.5 font-mono text-xs font-bold uppercase leading-none tracking-[0.06em] text-paper no-underline transition-colors hover:border-signal hover:bg-signal hover:text-ink"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
