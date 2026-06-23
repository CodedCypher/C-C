import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks — Pagination
 *
 * Brutalist prev / next controls + "Page X of Y" + an "N items" caption.
 * Router-agnostic: selecting a page calls `onPageChange(page)`; the page owns
 * how that maps to state/URL (e.g. `useNavigate({ search })` or local state).
 * Prev/Next disable at the bounds (rendered as inert `<button disabled>`).
 */

const baseBtn =
  "inline-flex items-center gap-1.5 border-2 border-line px-3 py-2 font-mono text-[0.8125rem] font-bold uppercase leading-none tracking-[0.06em]";

const enabledBtn =
  "cr-press bg-paper text-ink shadow-press hover:bg-signal hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink";

const disabledBtn =
  "bg-paper-2 text-dark-meta shadow-none cursor-not-allowed select-none";

export function Pagination({
  page,
  take,
  total,
  onPageChange,
}: {
  page: number;
  take: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const safeTake = take > 0 ? take : 1;
  const pageCount = Math.max(1, Math.ceil(total / safeTake));
  const current = Math.min(Math.max(page, 1), pageCount);

  const hasPrev = current > 1;
  const hasNext = current < pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
        {total.toLocaleString()} {total === 1 ? "item" : "items"}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          rel="prev"
          disabled={!hasPrev}
          onClick={() => onPageChange(current - 1)}
          className={cn(baseBtn, hasPrev ? enabledBtn : disabledBtn)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Prev
        </button>

        <span className="px-1 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink">
          Page {current} <span className="text-dark-meta">of</span> {pageCount}
        </span>

        <button
          type="button"
          rel="next"
          disabled={!hasNext}
          onClick={() => onPageChange(current + 1)}
          className={cn(baseBtn, hasNext ? enabledBtn : disabledBtn)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
