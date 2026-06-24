/**
 * circuit.rocks — bom feature: explosion tree renderer.
 *
 * Renders the recursive `BomExplosionNode[]` from `GET /bom/:id/explode` as an
 * INDENTED, expand/collapse tree. Each row shows the input's name + mono SKU,
 * its extended quantity + uom, and a "Built" badge for sub-assemblies (nodes
 * with `kind === "VARIANT"` and/or children). Branch rows toggle their subtree;
 * leaves render as a static row.
 *
 * Brutalist styling; depth is conveyed by a left rule + padding, not color, so
 * it stays legible at high contrast. Motion-reduce safe (no transitions on the
 * disclosure).
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Dot } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { BomExplosionNode } from "../types/bom.types";

function formatQty(n: number): string {
  // Trim trailing zeros from the 4dp decimals for a tidy display.
  return Number.isFinite(n)
    ? String(Number(n.toFixed(4)))
    : String(n);
}

function TreeRow({ node, depth }: { node: BomExplosionNode; depth: number }) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center justify-between gap-3 border-b-2 border-line px-3 py-2 last:border-b-0 hover:bg-signal/10"
        style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? "Collapse" : "Expand"}
              onClick={() => setOpen((o) => !o)}
              className="cr-press inline-flex size-5 shrink-0 items-center justify-center border-2 border-line bg-paper text-ink shadow-none outline-none hover:bg-signal focus-visible:ring-2 focus-visible:ring-ink"
            >
              {open ? (
                <ChevronDown className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-3.5" aria-hidden="true" />
              )}
            </button>
          ) : (
            <Dot className="size-5 shrink-0 text-smoke" aria-hidden="true" />
          )}

          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{node.name}</span>
            <span className="truncate font-mono text-[0.6875rem] text-smoke">
              {node.sku}
              {node.scrapPct != null && node.scrapPct > 0
                ? ` · scrap ${formatQty(node.scrapPct)}`
                : ""}
            </span>
          </span>

          {node.isBuilt || node.kind === "VARIANT" ? (
            <Badge variant="signal" size="sm">
              Built
            </Badge>
          ) : null}
        </div>

        <span className="shrink-0 whitespace-nowrap font-mono text-[0.8125rem] font-bold text-ink">
          {formatQty(node.extendedQty)}{" "}
          <span className="font-normal text-smoke">{node.uom}</span>
        </span>
      </div>

      {hasChildren && open ? (
        <div
          className={cn(
            "flex flex-col border-l-2 border-line",
            // The left rule sits under the row's indent.
          )}
          style={{ marginLeft: `${0.75 + depth * 1.25 + 0.5}rem` }}
        >
          {node.children.map((child) => (
            <TreeRow
              key={`${child.stockItemId}-${child.sku}`}
              node={child}
              depth={0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BomTree({ tree }: { tree: BomExplosionNode[] }) {
  if (tree.length === 0) {
    return (
      <p className="px-3 py-6 text-center font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-smoke">
        No components
      </p>
    );
  }
  return (
    <div className="border-2 border-line bg-paper shadow-press">
      {tree.map((node) => (
        <TreeRow
          key={`${node.stockItemId}-${node.sku}`}
          node={node}
          depth={0}
        />
      ))}
    </div>
  );
}
