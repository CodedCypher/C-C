import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks — SectionLabel
 * The brand's signature device: a mono uppercase label rendered as a filename
 * or // comment. Use as section eyebrows throughout LOUD zones.
 */
export function SectionLabel({
  children,
  comment = true,
  onDark = false,
  accent = false,
  className,
}: {
  children: ReactNode;
  comment?: boolean;
  onDark?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[0.8125rem] uppercase leading-none tracking-[0.06em]",
        accent ? "text-signal" : onDark ? "text-dark-meta" : "text-smoke",
        className,
      )}
    >
      {comment ? "// " : ""}
      {children}
    </div>
  );
}
