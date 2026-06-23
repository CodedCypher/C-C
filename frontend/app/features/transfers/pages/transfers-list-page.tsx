/**
 * circuit.rocks — transfers feature: list page.
 *
 * Lists inter-warehouse stock transfers. Filters (status tabs + transferNumber
 * search + page) live in local component state and drive the `useTransfers`
 * query key, so changing a filter refetches + caches automatically. Search/
 * status/pagination UI uses the shared PageHeader / DataTable / Pagination.
 *
 * Rows link to the detail route (`/transfers/$transferId`). The "New transfer"
 * header action navigates to `/transfers/new`.
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally (or in router search params)
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Search, Truck } from "lucide-react";

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
import { useTransfers } from "../hooks/use-transfers";
import type { TransferRow, TransferStatus } from "../types/transfers.types";

const TAKE = 20;

/** All tabs: "All" (no filter) + one per backend status, in lifecycle order. */
const STATUS_TABS: { label: string; value: "" | TransferStatus }[] = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Requested", value: "REQUESTED" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Partial", value: "PARTIALLY_RECEIVED" },
  { label: "Received", value: "RECEIVED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const columns: Column<TransferRow>[] = [
  {
    key: "transferNumber",
    header: "Transfer #",
    render: (r) => (
      <Link
        to="/transfers/$transferId"
        params={{ transferId: r.id }}
        className="font-mono font-medium text-ink underline decoration-line decoration-2 underline-offset-4 outline-none hover:decoration-signal focus-visible:ring-2 focus-visible:ring-ink"
      >
        {r.transferNumber}
      </Link>
    ),
  },
  {
    key: "route",
    header: "Source → Dest",
    render: (r) => (
      <span className="inline-flex items-center gap-2 font-mono text-[0.8125rem] text-ink">
        <span title={r.sourceWarehouse.name}>{r.sourceWarehouse.code}</span>
        <ArrowRight className="size-3.5 text-smoke" aria-hidden="true" />
        <span title={r.destWarehouse.name}>{r.destWarehouse.code}</span>
      </span>
    ),
  },
  {
    key: "lineCount",
    header: "Lines",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.lineCount}</span>,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    render: (r) => <StatusPill kind="transfer" value={r.status} />,
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

export function TransfersListPage() {
  const [status, setStatus] = useState<"" | TransferStatus>("");
  const [q, setQ] = useState("");
  // The committed search term (search box only applies on submit).
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useTransfers({
    status: status || undefined,
    q: committedQ || undefined,
    page,
    take: TAKE,
  });

  const tabs: PageHeaderTab[] = STATUS_TABS.map((t) => ({
    label: t.label,
    value: t.value,
    active: status === t.value,
  }));

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
        title="Stock Transfers"
        description="Move stock between warehouses with a ship / receive lifecycle. Filter by status or search by transfer number."
        tabs={tabs}
        onTabChange={(value) => {
          setStatus(value as "" | TransferStatus);
          setPage(1);
        }}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/transfers/new">
              <Plus className="size-4" aria-hidden="true" />
              New transfer
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
            placeholder="Search transfer number…"
            aria-label="Search transfers"
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
          icon={<Truck className="size-6" aria-hidden="true" />}
          title="Could not load transfers"
          description="Something went wrong fetching stock transfers. Try again."
        />
      ) : (
        <>
          <DataTable<TransferRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<Truck className="size-6" aria-hidden="true" />}
                title="No transfers found"
                description={
                  hasFilters
                    ? "No transfers match these filters. Try clearing the search or status."
                    : "Create a transfer to move stock from one warehouse to another. Drafts can be requested, shipped and received here."
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
                  ) : (
                    <Button asChild variant="primary" size="sm">
                      <Link to="/transfers/new">
                        <Plus className="size-4" aria-hidden="true" />
                        New transfer
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
