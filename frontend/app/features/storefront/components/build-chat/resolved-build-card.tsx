/**
 * Inline resolved-build card — the chat-thread counterpart of BuildDetailPage.
 * When an assistant turn resolves a parts list, it's rendered right inside the
 * conversation as a compact, addable card: matched parts with stock badges, the
 * unmatched gaps, an estimated total, "Add all to cart", and a link to the full
 * shareable /builds/$id view (which keeps the swap/alternatives controls).
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package, Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";

import { useAddToCart } from "../../hooks/use-storefront";
import { useCartUI } from "../cart-context";
import { AVAILABILITY_META, type BuildDetail } from "../../types/storefront.types";

export function ResolvedBuildCard({ build }: { build: BuildDetail }) {
  const addToCart = useAddToCart();
  const { openCart } = useCartUI();
  const [adding, setAdding] = useState(false);

  const addable = build.parts.filter((p) => p.canAdd);
  const total = addable.reduce((s, p) => s + p.unitPrice * p.requiredQty, 0);

  async function addAll() {
    if (addable.length === 0 || adding) return;
    setAdding(true);
    try {
      for (const p of addable) {
        await addToCart.mutateAsync({
          variantId: p.variantId,
          quantity: p.requiredQty,
        });
      }
      openCart();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex w-full flex-col border-2 border-line bg-paper shadow-brutal">
      <div className="flex items-center justify-between gap-3 border-b-2 border-line px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {build.title}
        </span>
        <Badge
          variant={build.inStockCount === build.partCount ? "stock" : "signal"}
          size="sm"
        >
          {build.inStockCount}/{build.partCount} ready
        </Badge>
      </div>

      <ul className="flex flex-col gap-1.5 p-4">
        {build.parts.map((p) => {
          const meta = AVAILABILITY_META[p.availability];
          return (
            <li
              key={p.lineId}
              className="flex items-center gap-3 border-2 border-line bg-paper px-3 py-2"
            >
              <div className="flex size-9 shrink-0 items-center justify-center border-2 border-line">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.title}
                    className="size-full object-contain p-1 [mix-blend-mode:multiply]"
                    loading="lazy"
                  />
                ) : (
                  <Package className="size-4 text-smoke" aria-hidden="true" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-sans text-[0.8125rem] font-semibold text-ink">
                  {p.title}
                </span>
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.06em] text-smoke">
                  {p.requiredQty} {p.unit} × {peso2(p.unitPrice)}
                </span>
              </div>
              <Badge variant={meta.variant} size="sm">
                {meta.label}
              </Badge>
            </li>
          );
        })}

        {build.unmatched.map((line, i) => (
          <li
            key={`unmatched-${i}`}
            className="flex items-center gap-3 border-2 border-dashed border-line bg-paper-2 px-3 py-2"
          >
            <div className="flex size-9 shrink-0 items-center justify-center border-2 border-dashed border-line">
              <Package className="size-4 text-smoke" aria-hidden="true" />
            </div>
            <span className="min-w-0 flex-1 truncate font-sans text-[0.8125rem] text-ink">
              {line.rawLabel}
            </span>
            <Badge variant="soldout" size="sm">
              No match
            </Badge>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-line px-4 py-3">
        <div className="flex flex-col">
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.06em] text-smoke">
            {addable.length} in-stock · est. total
          </span>
          <span className="font-mono text-[1.125rem] font-bold text-ink">
            {peso2(total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/builds/$id" params={{ id: build.id }}>
              Open full build →
            </Link>
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={addable.length === 0 || adding}
            onClick={addAll}
          >
            {adding ? "Adding…" : "Add all to cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}
