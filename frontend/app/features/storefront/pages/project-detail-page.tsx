/**
 * circuit.rocks — storefront Project detail (public route /projects/$slug).
 *
 * The hackathon payoff: a kit's bill of materials, resolved into purchasable,
 * stock-checked parts. In-stock parts are pre-selected; out-of-stock parts are
 * flagged + locked. One click adds every selected part (at its required qty) to
 * the guest cart and pops the drawer — a ready-to-checkout cart of in-stock
 * components, straight from the BOM.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Package, Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";

import { useAddToCart, useProject } from "../hooks/use-storefront";
import { useCartUI } from "../components/cart-context";
import {
  AVAILABILITY_META,
  type ProjectPart,
} from "../types/storefront.types";

const MAXW = "mx-auto max-w-[1320px]";

function PartRow({
  part,
  checked,
  onToggle,
}: {
  part: ProjectPart;
  checked: boolean;
  onToggle: () => void;
}) {
  const meta = AVAILABILITY_META[part.availability];
  return (
    <label
      className={
        "flex items-center gap-4 border-2 border-line bg-paper px-4 py-3 " +
        (part.canAdd ? "cursor-pointer" : "opacity-60")
      }
    >
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-signal"
        checked={checked}
        disabled={!part.canAdd}
        onChange={onToggle}
      />

      <div className="flex size-14 shrink-0 items-center justify-center border-2 border-line bg-paper">
        {part.image ? (
          <img
            src={part.image}
            alt={part.title}
            className="size-full object-contain p-1.5 [mix-blend-mode:multiply]"
            loading="lazy"
          />
        ) : (
          <Package className="size-6 text-smoke" aria-hidden="true" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-sans text-[0.9375rem] font-semibold text-ink">
          {part.title}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
          SKU: {part.sku} · {part.requiredQty} {part.unit} × {peso2(part.unitPrice)}
        </span>
      </div>

      <Badge variant={meta.variant} size="sm">
        {meta.label}
      </Badge>

      <span className="w-24 shrink-0 text-right font-mono text-[0.9375rem] font-bold text-ink">
        {peso2(part.lineTotal)}
      </span>
    </label>
  );
}

export function ProjectDetailPage() {
  const params = useParams({ strict: false });
  const slug = (params as { slug?: string }).slug ?? "";
  const { data: project, isLoading, isError } = useProject(slug);

  const addToCart = useAddToCart();
  const { openCart } = useCartUI();

  // variantId → selected. Initialised to "every in-stock part" once loaded;
  // reset when the slug changes (navigating between kits).
  const [picked, setPicked] = useState<Record<string, boolean> | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setPicked(null);
  }, [slug]);

  useEffect(() => {
    if (project && picked === null) {
      const init: Record<string, boolean> = {};
      for (const p of project.parts) init[p.variantId] = p.canAdd;
      setPicked(init);
    }
  }, [project, picked]);

  const backLink = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/projects">
        <ArrowLeft className="size-4" aria-hidden="true" />
        All projects
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
            <div key={i} className="h-20 animate-pulse border-2 border-line bg-paper-2" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className={`${MAXW} flex flex-col items-center gap-4 px-6 py-24 text-center`}>
        <p className="cr-mono text-soldout">// 404</p>
        <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
          Project not found
        </h1>
        <Button asChild variant="primary">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const pick = picked ?? {};
  const selectedParts = project.parts.filter((p) => p.canAdd && pick[p.variantId]);
  const selectedTotal = selectedParts.reduce((sum, p) => sum + p.lineTotal, 0);
  const unavailableCount = project.parts.filter((p) => !p.canAdd).length;
  const savings = project.assembledPrice - selectedTotal;

  function toggle(variantId: string) {
    setPicked((prev) => ({ ...(prev ?? {}), [variantId]: !(prev ?? {})[variantId] }));
  }

  async function handleAddSelected() {
    if (selectedParts.length === 0) return;
    setAdding(true);
    try {
      for (const p of selectedParts) {
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
    <div className={`${MAXW} flex flex-col gap-8 px-6 py-12`}>
      {backLink}

      {/* Hero */}
      <div className="grid gap-8 md:grid-cols-[320px_1fr]">
        <div className="flex aspect-square items-center justify-center border-2 border-line bg-paper shadow-brutal">
          {project.primaryImage ? (
            <img
              src={project.primaryImage}
              alt={project.title}
              className="size-full object-contain p-8 [mix-blend-mode:multiply]"
            />
          ) : (
            <Package className="size-16 text-smoke" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <span className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
            // build-it-yourself kit
          </span>
          <h1 className="font-sans text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {project.title}
          </h1>
          {project.description && (
            <p className="max-w-[60ch] text-[0.9375rem] leading-[1.6] text-smoke">
              {project.description}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Badge
              variant={
                project.inStockCount === project.partCount ? "stock" : "signal"
              }
              size="md"
            >
              {project.inStockCount}/{project.partCount} parts in stock
            </Badge>
            <span className="font-mono text-[0.8125rem] text-smoke">
              assembled: {peso2(project.assembledPrice)}
            </span>
          </div>

          {savings > 0 && (
            <p className="font-mono text-[0.8125rem] text-ink">
              Build it yourself for{" "}
              <span className="font-bold">{peso2(selectedTotal)}</span> — save{" "}
              <span className="font-bold text-stock">{peso2(savings)}</span> vs
              the assembled kit.
            </p>
          )}
        </div>
      </div>

      {/* Start-from-your-own-inspiration CTA */}
      <Link
        to="/build"
        className="cr-press flex items-center gap-2 border-2 border-line bg-paper-2 px-4 py-3 font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-ink no-underline shadow-brutal hover:shadow-press active:shadow-none"
      >
        <Sparkles className="size-4 text-signal" aria-hidden="true" />
        Have a different build? Resolve your own parts list →
      </Link>

      {/* Parts list */}
      <section className="flex flex-col gap-3 border-t-2 border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-smoke">
            // resolved parts ({project.partCount})
          </h2>
          {unavailableCount > 0 && (
            <span className="font-mono text-[0.75rem] text-soldout">
              {unavailableCount} part{unavailableCount > 1 ? "s" : ""} unavailable
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {project.parts.map((part) => (
            <PartRow
              key={part.variantId}
              part={part}
              checked={Boolean(pick[part.variantId]) && part.canAdd}
              onToggle={() => toggle(part.variantId)}
            />
          ))}
        </div>
      </section>

      {/* Add-to-cart bar */}
      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 border-2 border-line bg-paper px-5 py-4 shadow-brutal">
        <div className="flex flex-col">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            {selectedParts.length} part{selectedParts.length === 1 ? "" : "s"}{" "}
            selected
          </span>
          <span className="font-mono text-[1.375rem] font-bold text-ink">
            {peso2(selectedTotal)}
          </span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={selectedParts.length === 0 || adding}
          onClick={handleAddSelected}
        >
          {adding ? "Adding…" : "Add selected parts to cart →"}
        </Button>
      </div>
    </div>
  );
}
