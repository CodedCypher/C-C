/**
 * circuit.rocks — orders feature: list page.
 *
 * Ported from the old SSR `routes/admin/orders.tsx`. The loader is gone: data
 * comes from `useOrders({ status, q, page, take })`. Filters live in local
 * component state (status tabs, search box, page) and drive the query key, so
 * changing a filter refetches + caches automatically. Status/search/pagination
 * UI uses the shared PageHeader / DataTable / Pagination.
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally (or in router search params)
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Search, ShoppingCart } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  StatusPill,
  TableSkeleton,
  type Column,
  type PageHeaderTab,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import { formatDate, peso } from "~/lib/format";
import { useOrders } from "../hooks/use-orders";
import {
  orderStatusSchema,
  type OrderRow,
  type OrderStatus,
} from "../types/orders.types";

const TAKE = 20;

/** OrderStatus enum values (mirrors the backend Prisma enum). */
const ORDER_STATUSES = orderStatusSchema.options;

/** "PARTIALLY_FULFILLED" → "Partially Fulfilled". */
function statusLabel(s: OrderStatus): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const columns: Column<OrderRow>[] = [
  {
    key: "orderNumber",
    header: "Order #",
    render: (r) => <span className="font-mono text-ink">{r.orderNumber}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (r) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{r.customer}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{r.email}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusPill kind="order" value={r.status} />,
  },
  {
    key: "lineCount",
    header: "Items",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.lineCount}</span>,
  },
  {
    key: "grandTotal",
    header: "Total",
    align: "right",
    render: (r) => (
      <span className="font-mono text-ink">{peso(r.grandTotal)}</span>
    ),
  },
  {
    key: "placedAt",
    header: "Date",
    align: "right",
    render: (r) => (
      <span className="whitespace-nowrap text-smoke">
        {formatDate(r.placedAt)}
      </span>
    ),
  },
];

export function OrdersListPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  // The committed search term (search box only applies on submit).
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useOrders({
    status: status || undefined,
    q: committedQ || undefined,
    page,
    take: TAKE,
  });

  const tabs: PageHeaderTab[] = [
    { label: "All", value: "", active: status === "" },
    ...ORDER_STATUSES.map((s) => ({
      label: statusLabel(s),
      value: s,
      active: status === s,
    })),
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
        title="Orders"
        description="Every order placed across the storefront. Filter by status or search."
        tabs={tabs}
        onTabChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
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
            placeholder="Search order #, customer, email…"
            aria-label="Search orders"
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
          icon={<ShoppingCart className="size-6" aria-hidden="true" />}
          title="Could not load orders"
          description="Something went wrong fetching orders. Try again."
        />
      ) : (
        <>
          <DataTable<OrderRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.orderNumber}
            empty={
              <EmptyState
                icon={<ShoppingCart className="size-6" aria-hidden="true" />}
                title="No orders found"
                description={
                  hasFilters
                    ? "No orders match these filters. Try clearing the search or status."
                    : "Orders will appear here once customers start checking out."
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
