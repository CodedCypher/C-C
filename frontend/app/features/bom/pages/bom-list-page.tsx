/**
 * circuit.rocks — bom feature: variant index page (route /boms).
 *
 * Lists every product variant alongside its Bill-of-Materials status: how many
 * versions exist and whether one is active. Search (by name/SKU) + page live in
 * local component state and drive the `useBomVariants` query key, so changing a
 * filter refetches + caches automatically. Rows link to the per-variant editor
 * (`/boms/$variantId`), the centerpiece of this feature.
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Boxes, Search } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useBomVariants } from "../hooks/use-bom";
import type { BomVariantRow } from "../types/bom.types";

const TAKE = 20;

const columns: Column<BomVariantRow>[] = [
  {
    key: "title",
    header: "Product",
    render: (r) => (
      <Link
        to="/boms/$variantId"
        params={{ variantId: r.variantId }}
        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <span className="font-medium text-ink underline-offset-2 hover:underline">
          {r.title}
        </span>
        <span className="font-mono text-[0.75rem] text-smoke">{r.sku}</span>
      </Link>
    ),
  },
  {
    key: "sourcingType",
    header: "Sourcing",
    render: (r) => (
      <Badge variant={r.sourcingType === "BUILT" ? "signal" : "neutral"} size="sm">
        {r.sourcingType === "BUILT" ? "Built" : "Purchased"}
      </Badge>
    ),
  },
  {
    key: "versionCount",
    header: "Versions",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.versionCount}</span>,
  },
  {
    key: "hasActiveBom",
    header: "Active BOM",
    align: "right",
    render: (r) =>
      r.hasActiveBom ? (
        <StatusPill kind="build" value="DONE" />
      ) : (
        <Badge variant="neutral" size="sm">
          None
        </Badge>
      ),
  },
  {
    key: "manage",
    header: "Manage",
    align: "right",
    render: (r) => (
      <Button asChild variant="secondary" size="sm">
        <Link to="/boms/$variantId" params={{ variantId: r.variantId }}>
          {r.versionCount > 0 ? "Edit BOM" : "Build BOM"}
        </Link>
      </Button>
    ),
  },
];

export function BomListPage() {
  const [q, setQ] = useState("");
  // The committed search term (search box only applies on submit).
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useBomVariants({
    q: committedQ || undefined,
    page,
    take: TAKE,
  });

  const hasFilters = committedQ !== "";

  function clearFilters() {
    setQ("");
    setCommittedQ("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bills of Materials"
        description="Every variant and its BOM status. Build a multi-level recipe of materials and sub-assemblies, roll up cost, and check build feasibility against warehouse stock."
      />

      <form
        className="flex w-full max-w-md items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCommittedQ(q.trim());
          setPage(1);
        }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-smoke"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product name or SKU…"
            aria-label="Search variants"
            className="w-full border-2 border-line bg-paper py-2.5 pl-9 pr-3 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink"
          />
        </div>
        <Button type="submit" variant="primary" size="md">
          Search
        </Button>
      </form>

      {isLoading ? (
        <TableSkeleton rows={8} cols={columns.length} />
      ) : isError ? (
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden="true" />}
          title="Could not load variants"
          description="Something went wrong fetching the BOM index. Try again."
        />
      ) : (
        <>
          <DataTable<BomVariantRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.variantId}
            empty={
              <EmptyState
                icon={<Boxes className="size-6" aria-hidden="true" />}
                title="No variants found"
                description={
                  hasFilters
                    ? "No variants match this search. Try clearing it."
                    : "Variants appear here once products exist. Open one to define its Bill of Materials."
                }
                action={
                  hasFilters ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={clearFilters}
                    >
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            }
          />

          <Pagination
            page={page}
            take={data?.take ?? TAKE}
            total={data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
