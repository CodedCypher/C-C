/**
 * circuit.rocks — products feature: list page.
 *
 * Ported from the old SSR `routes/admin/products.tsx`. The loader is gone:
 * data comes from `useProducts({ status, q, page, take })`. Filters live in
 * local component state (status tabs, search box, page) and drive the query key,
 * so changing a filter refetches + caches automatically. Search/status/
 * pagination UI uses the shared PageHeader / DataTable / Pagination.
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally (or in router search params)
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package, Plus, Search } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  TableSkeleton,
  type Column,
  type PageHeaderTab,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso } from "~/lib/format";
import { useProducts } from "../hooks/use-products";
import type { ProductRow, ProductStatus } from "../types/products.types";

const TAKE = 20;

/** ProductStatus → Badge variant + label. */
const STATUS_BADGE: Record<
  ProductStatus,
  { variant: "stock" | "neutral" | "soldout"; label: string }
> = {
  ACTIVE: { variant: "stock", label: "Active" },
  DRAFT: { variant: "neutral", label: "Draft" },
  ARCHIVED: { variant: "soldout", label: "Archived" },
};

function priceLabel(row: ProductRow): string {
  return row.priceMin === row.priceMax
    ? peso(row.priceMin)
    : `${peso(row.priceMin)}–${peso(row.priceMax)}`;
}

const columns: Column<ProductRow>[] = [
  {
    key: "title",
    header: "Product",
    render: (r) => (
      <div className="flex items-center gap-3">
        {r.primaryImage ? (
          <img
            src={r.primaryImage}
            alt=""
            className="size-10 shrink-0 border-2 border-line object-cover"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center border-2 border-line bg-paper-2 text-dark-meta"
          >
            <Package className="size-4" />
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink">{r.title}</span>
          {r.brand ? (
            <span className="font-mono text-[0.75rem] text-smoke">{r.brand}</span>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    key: "variantCount",
    header: "Variants",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.variantCount}</span>,
  },
  {
    key: "price",
    header: "Price",
    align: "right",
    render: (r) => (
      <span className="whitespace-nowrap font-mono text-ink">{priceLabel(r)}</span>
    ),
  },
  {
    key: "totalOnHand",
    header: "Stock",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.totalOnHand}</span>,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    render: (r) => {
      const meta = STATUS_BADGE[r.status];
      return (
        <Badge variant={meta.variant} size="sm">
          {meta.label}
        </Badge>
      );
    },
  },
];

export function ProductsListPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  // The committed search term (search box only applies on submit).
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useProducts({
    status: status || undefined,
    q: committedQ || undefined,
    page,
    take: TAKE,
  });

  const tabs: PageHeaderTab[] = [
    { label: "All", value: "", active: status === "" },
    { label: "Active", value: "ACTIVE", active: status === "ACTIVE" },
    { label: "Draft", value: "DRAFT", active: status === "DRAFT" },
    { label: "Archived", value: "ARCHIVED", active: status === "ARCHIVED" },
  ];

  const hasFilters = committedQ !== "" || status !== "";

  function clearFilters() {
    setStatus("");
    setQ("");
    setCommittedQ("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Your catalog — variants, pricing and stock per product. Filter by status."
        tabs={tabs}
        onTabChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/products/new">
              <Plus className="size-4" aria-hidden="true" />
              Add product
            </Link>
          </Button>
        }
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
            placeholder="Search title or brand…"
            aria-label="Search products"
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
          icon={<Package className="size-6" aria-hidden="true" />}
          title="Could not load products"
          description="Something went wrong fetching the catalog. Try again."
        />
      ) : (
        <>
          <DataTable<ProductRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.slug}
            empty={
              <EmptyState
                icon={<Package className="size-6" aria-hidden="true" />}
                title="No products found"
                description={
                  hasFilters
                    ? "No products match these filters. Try clearing the search or status."
                    : "Products you create will appear here."
                }
                action={
                  hasFilters ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={clearFilters}
                    >
                      Clear filters
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
