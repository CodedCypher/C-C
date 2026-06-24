/**
 * circuit.rocks — resolved Build detail (public route /builds/$id).
 *
 * Matched parts are stock-checked + pre-selected. When the matcher's primary
 * pick is out of stock, the backend auto-swaps to an in-stock alternative and
 * flags it ("swapped from your '…'"); the maker can expand options to pick a
 * different equivalent or revert to the original. One click adds the in-stock
 * selection to the guest cart — shareable by this page's URL.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, Package, Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";

import { useAddToCart, useBuild } from "../hooks/use-storefront";
import { useCartUI } from "../components/cart-context";
import {
  AVAILABILITY_META,
  type BuildPart,
  type BuildSource,
  type BuildUnmatchedLine,
  type StockState,
} from "../types/storefront.types";

const MAXW = "mx-auto max-w-[1320px]";

/** Source-aware eyebrow line, so a photo/link build doesn't claim "parts list". */
const SOURCE_EYEBROW: Record<BuildSource, string> = {
  TEXT: "resolved from your parts list",
  URL: "resolved from a link",
  IMAGE: "resolved from your photo",
};

/** A switchable variant for a line — the chosen part itself, or an alternative. */
type Candidate = {
  variantId: string;
  sku: string;
  title: string;
  image: string | null;
  unitPrice: number;
  availability: StockState;
  canAdd: boolean;
};

function partCandidate(p: BuildPart): Candidate {
  return {
    variantId: p.variantId,
    sku: p.sku,
    title: p.title,
    image: p.image,
    unitPrice: p.unitPrice,
    availability: p.availability,
    canAdd: p.canAdd,
  };
}

/** The chosen part + its alternatives, all as uniform switchable candidates. */
function candidatesFor(p: BuildPart): Candidate[] {
  return [
    partCandidate(p),
    ...p.alternatives.map((a) => ({
      variantId: a.variantId,
      sku: a.sku,
      title: a.title,
      image: a.image,
      unitPrice: a.unitPrice,
      availability: a.availability,
      canAdd: a.canAdd,
    })),
  ];
}

function BuildPartRow({
  part,
  active,
  candidates,
  checked,
  optsOpen,
  onToggle,
  onToggleOpts,
  onChoose,
}: {
  part: BuildPart;
  active: Candidate;
  candidates: Candidate[];
  checked: boolean;
  optsOpen: boolean;
  onToggle: () => void;
  onToggleOpts: () => void;
  onChoose: (variantId: string) => void;
}) {
  const meta = AVAILABILITY_META[active.availability];
  const swapped = active.variantId !== part.variantId || part.swappedFrom !== null;
  return (
    <div className="flex flex-col border-2 border-line bg-paper">
      <label
        className={
          "flex items-center gap-4 px-4 py-3 " +
          (active.canAdd ? "cursor-pointer" : "opacity-60")
        }
      >
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-signal"
          checked={checked}
          disabled={!active.canAdd}
          onChange={onToggle}
        />

        <div className="flex size-14 shrink-0 items-center justify-center border-2 border-line bg-paper">
          {active.image ? (
            <img
              src={active.image}
              alt={active.title}
              className="size-full object-contain p-1.5 [mix-blend-mode:multiply]"
              loading="lazy"
            />
          ) : (
            <Package className="size-6 text-smoke" aria-hidden="true" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-sans text-[0.9375rem] font-semibold text-ink">
            {active.title}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            you asked: “{part.rawLabel}”
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            SKU: {active.sku} · {part.requiredQty} {part.unit} ×{" "}
            {peso2(active.unitPrice)}
          </span>
          {swapped && part.swappedFrom && (
            <span className="font-mono text-[0.6875rem] text-signal">
              ⮑ in-stock swap — “{part.swappedFrom.title}” was out of stock
            </span>
          )}
        </div>

        <div className="flex w-28 shrink-0 flex-col items-end gap-1">
          <Badge variant={meta.variant} size="sm">
            {meta.label}
          </Badge>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.06em] text-smoke">
            {Math.round(part.confidence * 100)}% match
          </span>
        </div>

        <span className="w-24 shrink-0 text-right font-mono text-[0.9375rem] font-bold text-ink">
          {peso2(active.unitPrice * part.requiredQty)}
        </span>
      </label>

      {candidates.length > 1 && (
        <div className="border-t-2 border-dashed border-line">
          <button
            type="button"
            onClick={onToggleOpts}
            className="flex w-full items-center gap-1.5 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke hover:text-ink"
          >
            <ChevronDown
              className={"size-3.5 transition-transform " + (optsOpen ? "rotate-180" : "")}
              aria-hidden="true"
            />
            {candidates.length - 1} other option
            {candidates.length - 1 > 1 ? "s" : ""}
          </button>
          {optsOpen && (
            <ul className="flex flex-col gap-1 px-4 pb-3">
              {candidates.map((c) => {
                const cm = AVAILABILITY_META[c.availability];
                const isActive = c.variantId === active.variantId;
                return (
                  <li key={c.variantId}>
                    <button
                      type="button"
                      onClick={() => onChoose(c.variantId)}
                      className={
                        "flex w-full items-center gap-3 border-2 px-3 py-2 text-left " +
                        (isActive
                          ? "border-signal bg-paper-2"
                          : "border-line bg-paper hover:bg-paper-2")
                      }
                    >
                      <span className="font-mono text-[0.625rem] uppercase text-smoke">
                        {isActive ? "● selected" : "○ use this"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-sans text-[0.8125rem] text-ink">
                        {c.title}
                        {c.variantId === part.variantId && part.swappedFrom
                          ? " (your original ask)"
                          : ""}
                      </span>
                      <Badge variant={cm.variant} size="sm">
                        {cm.label}
                      </Badge>
                      <span className="font-mono text-[0.8125rem] font-bold text-ink">
                        {peso2(c.unitPrice)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UnmatchedRow({ line }: { line: BuildUnmatchedLine }) {
  return (
    <div className="flex items-center gap-4 border-2 border-dashed border-line bg-paper-2 px-4 py-3">
      <div className="flex size-14 shrink-0 items-center justify-center border-2 border-dashed border-line">
        <Package className="size-6 text-smoke" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-sans text-[0.9375rem] font-semibold text-ink">
          {line.rawLabel}
        </span>
        <span className="font-mono text-[0.6875rem] text-soldout">
          {line.note ?? "No catalog match found."}
        </span>
      </div>
      <Badge variant="soldout" size="sm">
        No match
      </Badge>
    </div>
  );
}

export function BuildDetailPage() {
  const params = useParams({ strict: false });
  const id = (params as { id?: string }).id ?? "";
  const { data: build, isLoading, isError } = useBuild(id);

  const addToCart = useAddToCart();
  const { openCart } = useCartUI();

  const [picked, setPicked] = useState<Record<string, boolean> | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [openOpts, setOpenOpts] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setPicked(null);
    setChosen({});
    setOpenOpts({});
  }, [id]);

  useEffect(() => {
    if (build && picked === null) {
      const initP: Record<string, boolean> = {};
      const initC: Record<string, string> = {};
      for (const p of build.parts) {
        initP[p.lineId] = p.canAdd;
        initC[p.lineId] = p.variantId;
      }
      setPicked(initP);
      setChosen(initC);
    }
  }, [build, picked]);

  const activeByLine = useMemo(() => {
    const map: Record<string, Candidate> = {};
    if (build) {
      for (const p of build.parts) {
        const cands = candidatesFor(p);
        const want = chosen[p.lineId] ?? p.variantId;
        map[p.lineId] = cands.find((c) => c.variantId === want) ?? partCandidate(p);
      }
    }
    return map;
  }, [build, chosen]);

  const backLink = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/build">
        <ArrowLeft className="size-4" aria-hidden="true" />
        New build
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className={`${MAXW} flex flex-col gap-6 px-6 py-12`}>
        {backLink}
        <div className="h-8 w-1/2 animate-pulse bg-paper-2" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse border-2 border-line bg-paper-2"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !build) {
    return (
      <div
        className={`${MAXW} flex flex-col items-center gap-4 px-6 py-24 text-center`}
      >
        <p className="cr-mono text-soldout">// 404</p>
        <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
          Build not found
        </h1>
        <Button asChild variant="primary">
          <Link to="/build">Start a new build</Link>
        </Button>
      </div>
    );
  }

  const pick = picked ?? {};
  const selected = build.parts.filter((p) => {
    const a = activeByLine[p.lineId];
    return a?.canAdd && pick[p.lineId];
  });
  const selectedTotal = selected.reduce(
    (sum, p) => sum + activeByLine[p.lineId].unitPrice * p.requiredQty,
    0,
  );
  // Ready = lines whose ACTIVE candidate is addable (swaps count as ready).
  const readyCount = build.parts.filter((p) => activeByLine[p.lineId]?.canAdd).length;
  const gapCount = build.partCount - readyCount;

  function toggle(lineId: string) {
    setPicked((prev) => ({ ...(prev ?? {}), [lineId]: !(prev ?? {})[lineId] }));
  }

  function choose(lineId: string, variantId: string, canAdd: boolean) {
    setChosen((prev) => ({ ...prev, [lineId]: variantId }));
    if (canAdd) setPicked((prev) => ({ ...(prev ?? {}), [lineId]: true }));
  }

  async function handleAddSelected() {
    if (selected.length === 0) return;
    setAdding(true);
    try {
      for (const p of selected) {
        await addToCart.mutateAsync({
          variantId: activeByLine[p.lineId].variantId,
          quantity: p.requiredQty,
        });
      }
      openCart();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={`${MAXW} flex flex-col gap-8 px-6 py-12`}>
      {backLink}

      <header className="flex flex-col gap-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
          <Sparkles className="size-3.5" aria-hidden="true" />
          // {SOURCE_EYEBROW[build.sourceType]}
        </span>
        <h1 className="font-sans text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
          {build.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={readyCount === build.partCount ? "stock" : "signal"}
            size="sm"
          >
            {readyCount}/{build.partCount} ready
          </Badge>
          {gapCount > 0 && (
            <span className="font-mono text-[0.8125rem] text-soldout">
              {gapCount} part{gapCount > 1 ? "s" : ""} need attention
            </span>
          )}
          <span className="font-mono text-[0.8125rem] text-smoke">
            selected total {peso2(selectedTotal)}
          </span>
        </div>
      </header>

      {build.parts.length > 0 && (
        <section className="flex flex-col gap-3 border-t-2 border-line pt-8">
          <h2 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-smoke">
            // matched parts ({build.parts.length})
          </h2>
          <div className="flex flex-col gap-2">
            {build.parts.map((part) => (
              <BuildPartRow
                key={part.lineId}
                part={part}
                active={activeByLine[part.lineId] ?? partCandidate(part)}
                candidates={candidatesFor(part)}
                checked={Boolean(pick[part.lineId]) && (activeByLine[part.lineId]?.canAdd ?? false)}
                optsOpen={Boolean(openOpts[part.lineId])}
                onToggle={() => toggle(part.lineId)}
                onToggleOpts={() =>
                  setOpenOpts((prev) => ({
                    ...prev,
                    [part.lineId]: !prev[part.lineId],
                  }))
                }
                onChoose={(variantId) => {
                  const cand = candidatesFor(part).find(
                    (c) => c.variantId === variantId,
                  );
                  choose(part.lineId, variantId, cand?.canAdd ?? false);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {build.unmatched.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-soldout">
            // couldn’t source ({build.unmatched.length})
          </h2>
          <div className="flex flex-col gap-2">
            {build.unmatched.map((line, i) => (
              <UnmatchedRow key={`${line.rawLabel}-${i}`} line={line} />
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 border-2 border-line bg-paper px-5 py-4 shadow-brutal">
        <div className="flex flex-col">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            {selected.length} part{selected.length === 1 ? "" : "s"} selected
          </span>
          <span className="font-mono text-[1.375rem] font-bold text-ink">
            {peso2(selectedTotal)}
          </span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={selected.length === 0 || adding}
          onClick={handleAddSelected}
        >
          {adding ? "Adding…" : "Add selected parts to cart →"}
        </Button>
      </div>
    </div>
  );
}
