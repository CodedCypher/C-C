/**
 * circuit.rocks — build-orders feature: list page.
 *
 * Lists manufacturing build orders (work orders). Filters (status tabs + page)
 * live in local component state and drive the `useBuildOrders` query key, so
 * changing a filter refetches + caches automatically. Status/pagination UI uses
 * the shared PageHeader / DataTable / Pagination.
 *
 * Rows link to the detail route (`/build-orders/$buildOrderId`). The "New build"
 * header action navigates to `/build-orders/new`.
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally (or in router search params)
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Factory, Plus } from "lucide-react";

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
import { formatDate } from "~/lib/format";
import { useBuildOrders } from "../hooks/use-build-orders";
import type {
  BuildOrderRow,
  BuildOrderStatus,
} from "../types/build-orders.types";

const TAKE = 20;

/** All tabs: "All" (no filter) + one per backend status, in lifecycle order. */
const STATUS_TABS: { label: string; value: "" | BuildOrderStatus }[] = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Planned", value: "PLANNED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const columns: Column<BuildOrderRow>[] = [
  {
    key: "product",
    header: "Product",
    render: (r) => (
      <Link
        to="/build-orders/$buildOrderId"
        params={{ buildOrderId: r.id }}
        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <span className="font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-signal">
          {r.productTitle}
        </span>
        <span className="font-mono text-[0.75rem] text-smoke">{r.sku}</span>
      </Link>
    ),
  },
  {
    key: "bomVersion",
    header: "BOM v",
    align: "right",
    render: (r) => (
      <span className="font-mono text-smoke">v{r.bomVersion}</span>
    ),
  },
  {
    key: "qtyPlanned",
    header: "Planned",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.qtyPlanned}</span>,
  },
  {
    key: "qtyProduced",
    header: "Produced",
    align: "right",
    render: (r) => (
      <span className="font-mono font-bold text-ink">{r.qtyProduced}</span>
    ),
  },
  {
    key: "warehouseCode",
    header: "Warehouse",
    render: (r) => (
      <span className="font-mono text-[0.8125rem] text-ink">
        {r.warehouseCode}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    render: (r) => <StatusPill kind="build" value={r.status} />,
  },
  {
    key: "createdAt",
    header: "Created",
    align: "right",
    render: (r) => (
      <span className="whitespace-nowrap font-mono text-smoke">
        {formatDate(r.createdAt)}
      </span>
    ),
  },
];

export function BuildOrdersListPage() {
  const [status, setStatus] = useState<"" | BuildOrderStatus>("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useBuildOrders({
    status: status || undefined,
    page,
    take: TAKE,
  });

  const tabs: PageHeaderTab[] = STATUS_TABS.map((t) => ({
    label: t.label,
    value: t.value,
    active: status === t.value,
  }));

  const hasFilters = status !== "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Build Orders"
        description="Manufacture finished goods from a bill of materials with a plan → start → complete lifecycle. Filter by status."
        tabs={tabs}
        onTabChange={(value) => {
          setStatus(value as "" | BuildOrderStatus);
          setPage(1);
        }}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/build-orders/new">
              <Plus className="size-4" aria-hidden="true" />
              New build
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={8} cols={columns.length} />
      ) : isError ? (
        <EmptyState
          icon={<Factory className="size-6" aria-hidden="true" />}
          title="Could not load build orders"
          description="Something went wrong fetching build orders. Try again."
        />
      ) : (
        <>
          <DataTable<BuildOrderRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<Factory className="size-6" aria-hidden="true" />}
                title="No build orders found"
                description={
                  hasFilters
                    ? "No build orders match this status. Try a different tab."
                    : "Create a build order to manufacture a variant from its bill of materials. Plan it to reserve components, start to consume them, then complete to post finished goods."
                }
                action={
                  hasFilters ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setStatus("");
                        setPage(1);
                      }}
                    >
                      Show all
                    </Button>
                  ) : (
                    <Button asChild variant="primary" size="sm">
                      <Link to="/build-orders/new">
                        <Plus className="size-4" aria-hidden="true" />
                        New build
                      </Link>
                    </Button>
                  )
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
