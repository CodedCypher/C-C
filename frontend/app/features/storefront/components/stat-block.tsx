import { cn } from "~/lib/utils";

/**
 * circuit.rocks — StatBlock
 * Huge Space Grotesk number + mono uppercase caption beneath. Rows of 3–4.
 */
export function StatBlock({
  value,
  caption,
  onDark = false,
  accent = false,
}: {
  value: string;
  caption: string;
  onDark?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={cn(
          "font-sans text-[clamp(2.25rem,4vw,3.25rem)] font-bold leading-[0.95] tracking-[-0.02em]",
          accent ? "text-signal" : onDark ? "text-paper" : "text-ink",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em]",
          onDark ? "text-dark-meta" : "text-smoke",
        )}
      >
        {caption}
      </span>
    </div>
  );
}
