/**
 * circuit.rocks — account feature: order history list (route /account/orders).
 *
 * The customer-facing mirror of the admin orders list, kept deliberately simple:
 * no status tabs, no search — just a paginated, read-only table of the signed-in
 * shopper's own orders. Reuses the shared DataTable / StatusPill / Pagination /
 * EmptyState / TableSkeleton + the same `peso`/`formatDate` formatters.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import {
  DataTable,
  EmptyState,
  Pagination,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import { formatDate, peso } from "~/lib/format";
import { useMyOrders } from "../hooks/use-account";
import type { MyOrderRow } from "../types/account.types";

const TAKE = 20;

const columns: Column<MyOrderRow>[] = [
  {
    key: "orderNumber",
    header: "Order #",
    render: (r) => (
      <Link
        to="/account/orders/$orderId"
        params={{ orderId: r.id }}
        className="font-mono text-ink underline-offset-2 hover:underline"
      >
        {r.orderNumber}
      </Link>
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

export function MyOrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useMyOrders({ page, take: TAKE });

  if (isLoading) {
    return <TableSkeleton rows={6} cols={columns.length} />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-6" aria-hidden="true" />}
        title="Could not load your orders"
        description="Something went wrong fetching your order history. Try again."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DataTable<MyOrderRow>
        columns={columns}
        rows={data?.rows ?? []}
        getRowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={<ShoppingBag className="size-6" aria-hidden="true" />}
            title="No orders yet"
            description="Your orders will show up here once you've checked out."
            action={
              <Button asChild variant="primary" size="sm">
                <Link to="/">Start shopping</Link>
              </Button>
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
    </div>
  );
}
