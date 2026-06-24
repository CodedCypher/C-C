/**
 * circuit.rocks — build-orders feature: output-variant picker (create form).
 *
 * A search-as-you-type combobox backed by `GET /bom/variants`. Typing filters
 * the dropdown; picking a row reports the chosen `BomVariantOption` up to the
 * form. Only variants with an active BOM (`hasActiveBom`) are selectable — the
 * rest render disabled with a "No BOM" tag so users understand why. Once a
 * variant is chosen the control shows its title/SKU + BOM versions; "Change"
 * re-opens the search.
 *
 * Brutalist styling, keyboard-dismissible, motion-reduce friendly. No external
 * combobox dep — a small controlled input + absolutely-positioned listbox.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { cn } from "~/lib/utils";
import { useBomVariantOptions } from "../hooks/use-bom-variant-options";
import { controlClass } from "./fields";
import type { BomVariantOption } from "../types/build-orders.types";

export function VariantPicker({
  value,
  onPick,
  invalid,
  "aria-label": ariaLabel,
}: {
  /** The currently-selected variant (or null when nothing picked yet). */
  value: BomVariantOption | null;
  onPick: (option: BomVariantOption | null) => void;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const { data, isLoading, isError, isFetching } = useBomVariantOptions(
    term,
    open,
  );
  const options = data?.rows ?? [];

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(option: BomVariantOption) {
    if (!option.hasActiveBom) return;
    onPick(option);
    setOpen(false);
    setTerm("");
  }

  // Picked state: show the chosen variant with a "Change" affordance.
  if (value && !open) {
    return (
      <div ref={containerRef} className="flex flex-col gap-1">
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-2 border-line bg-paper px-3 py-2 shadow-press",
            invalid && "border-soldout",
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-[0.8125rem] text-ink">
              {value.title}
            </span>
            <span className="truncate font-mono text-[0.6875rem] text-smoke">
              {value.sku} ·{" "}
              {value.versionCount === 1
                ? "1 BOM version"
                : `${value.versionCount} BOM versions`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTerm("");
            }}
            className="cr-press shrink-0 border-2 border-line bg-paper px-2 py-1 font-mono text-[0.625rem] font-bold uppercase tracking-[0.08em] text-smoke shadow-press outline-none hover:bg-signal hover:text-ink focus-visible:ring-2 focus-visible:ring-ink"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-smoke"
          aria-hidden="true"
        />
        <input
          type="search"
          value={term}
          aria-label={ariaLabel ?? "Search output variants"}
          aria-expanded={open}
          aria-controls={listboxId}
          role="combobox"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search title or SKU…"
          className={cn(controlClass, "pl-9 pr-8", invalid && "border-soldout")}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              onPick(null);
              setTerm("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-smoke hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border-2 border-line bg-paper shadow-brutal"
        >
          {isError ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-soldout">
              Could not load variants. Try again.
            </p>
          ) : isLoading || isFetching ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-smoke">
              Searching…
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-smoke">
              {term.trim()
                ? `No variants match “${term.trim()}”.`
                : "No buildable variants found."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {options.map((opt) => {
                const selected = value?.variantId === opt.variantId;
                const buildable = opt.hasActiveBom;
                return (
                  <li key={opt.variantId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={!buildable}
                      disabled={!buildable}
                      onClick={() => choose(opt)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 border-b-2 border-line px-3 py-2 text-left outline-none last:border-b-0",
                        buildable
                          ? "hover:bg-signal/15 focus-visible:bg-signal/15"
                          : "cursor-not-allowed opacity-55",
                        selected && "bg-signal/15",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-[0.8125rem] text-ink">
                          {opt.title}
                        </span>
                        <span className="truncate font-mono text-[0.6875rem] text-smoke">
                          {opt.sku} · {opt.sourcingType}
                        </span>
                      </span>
                      {selected ? (
                        <Check
                          className="size-4 shrink-0 text-ink"
                          aria-hidden="true"
                        />
                      ) : !buildable ? (
                        <span className="shrink-0 border-2 border-line px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-smoke">
                          No BOM
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
