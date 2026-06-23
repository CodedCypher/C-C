import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks — PageHeader
 *
 * Section header for every feature page: a fixed-size H1 (Space Grotesk bold,
 * ~1.75rem — NOT clamp), an optional description, a right-aligned actions slot,
 * and an optional row of filter tabs styled like a brutalist segmented control
 * (active = signal fill).
 *
 * Tabs are router-agnostic `<button>`s: each carries a `value`, and selecting a
 * tab calls `onTabChange(value)`. The page owns how that maps to state/URL
 * (e.g. `useNavigate({ search })` or local state) — this keeps the shared
 * component reusable across features with different search-param schemes.
 */

export interface PageHeaderTab {
  label: string;
  /** Opaque value handed back to `onTabChange` when this tab is selected. */
  value: string;
  active?: boolean;
  count?: number;
}

export function PageHeader({
  title,
  description,
  actions,
  tabs,
  onTabChange,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs?: PageHeaderTab[];
  /** Called with the selected tab's `value`. Required when `tabs` is set. */
  onTabChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-sans text-[1.75rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-smoke">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2 sm:pt-1">
            {actions}
          </div>
        ) : null}
      </div>

      {tabs && tabs.length > 0 ? (
        <div
          role="tablist"
          className="flex flex-wrap items-stretch border-2 border-line shadow-press w-fit max-w-full overflow-x-auto"
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={tab.active ? "true" : "false"}
              onClick={() => onTabChange?.(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink motion-reduce:transition-none",
                i > 0 && "border-l-2 border-line",
                tab.active
                  ? "bg-signal text-ink"
                  : "bg-paper text-smoke hover:bg-paper-2 hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] items-center justify-center border-2 border-line px-1 text-[0.6875rem] leading-none",
                    tab.active ? "bg-paper text-ink" : "bg-paper-2 text-smoke",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
