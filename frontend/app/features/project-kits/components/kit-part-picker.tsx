/**
 * Project-kits: catalog-part picker. A search-as-you-type combobox backed by
 * `GET /inventory/options?kind=VARIANT` — kit parts are always sellable catalog
 * products (raw materials are excluded server-side). Picking a row reports the
 * chosen KitPartOption up to the form. Self-contained local copy (features must
 * not import from one another).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

import { cn } from "~/lib/utils";
import { useKitPartOptions } from "../hooks/use-project-kits";
import { controlClass } from "./fields";
import type { KitPartOption } from "../types/project-kits.types";

export function KitPartPicker({
  onPick,
  invalid,
}: {
  onPick: (option: KitPartOption) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const { data, isLoading, isError, isFetching } = useKitPartOptions(
    term,
    open && term.trim().length > 0,
  );
  const options = data ?? [];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(option: KitPartOption) {
    onPick(option);
    setOpen(false);
    setTerm("");
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
          aria-label="Search catalog products"
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
          placeholder="Add a part — search name or SKU…"
          className={cn(controlClass, "pl-9", invalid && "border-soldout")}
        />
      </div>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto border-2 border-line bg-paper shadow-brutal"
        >
          {term.trim().length === 0 ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-smoke">
              Type to search catalog products…
            </p>
          ) : isError ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-soldout">
              Could not load products. Try again.
            </p>
          ) : isLoading || isFetching ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-smoke">
              Searching…
            </p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 font-mono text-[0.75rem] text-smoke">
              No products match “{term.trim()}”.
            </p>
          ) : (
            <ul className="flex flex-col">
              {options.map((opt) => (
                <li key={opt.stockItemId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => choose(opt)}
                    className="flex w-full items-center justify-between gap-3 border-b-2 border-line px-3 py-2 text-left outline-none last:border-b-0 hover:bg-signal/15 focus-visible:bg-signal/15"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-[0.8125rem] text-ink">
                        {opt.name}
                      </span>
                      <span className="truncate font-mono text-[0.6875rem] text-smoke">
                        {opt.sku}
                        {opt.price != null ? ` · ₱${opt.price.toFixed(2)}` : ""}
                      </span>
                    </span>
                    <Check
                      className="size-4 shrink-0 text-smoke opacity-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
