/**
 * circuit.rocks — inventory feature: list page.
 *
 * Ported from the old SSR `routes/admin/inventory.tsx`. The loader is gone:
 * data comes from `useInventory({ filter, q, warehouseId, page, take })` and the
 * warehouse <select> options from `useWarehouseOptions()`. Filters live in local
 * component state (filter tabs, warehouse select, search box, page) and drive the
 * query key, so changing a filter refetches + caches automatically. Filter/
 * search/pagination UI uses the shared PageHeader / DataTable / Pagination.
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally (or in router search params)
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
  type PageHeaderTab,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import { useInventory } from "../hooks/use-inventory";
import { useWarehouseOptions } from "../hooks/use-warehouse-options";
import type { InventoryRow } from "../types/inventory.types";

const TAKE = 20;

const columns: Column<InventoryRow>[] = [
  {
    key: "name",
    header: "Item",
    render: (r) => (
      <Link
        to="/inventory/$stockItemId"
        params={{ stockItemId: r.stockItemId }}
        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <span className="font-medium text-ink underline-offset-2 hover:underline">
          {r.name}
        </span>
        <span className="font-mono text-[0.75rem] text-smoke">{r.sku}</span>
      </Link>
    ),
  },
  {
    key: "kind",
    header: "Kind",
    render: (r) => (
      <span className="cr-micro text-smoke">
        {r.kind === "VARIANT" ? "Variant" : "Material"}
      </span>
    ),
  },
  {
    key: "onHand",
    header: "On hand",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.onHand}</span>,
  },
  {
    key: "reserved",
    header: "Reserved",
    align: "right",
    render: (r) => <span className="font-mono text-smoke">{r.reserved}</span>,
  },
  {
    key: "available",
    header: "Available",
    align: "right",
    render: (r) => (
      <span
        className={
          "font-mono font-bold " +
          (r.stockState === "OUT"
            ? "text-soldout"
            : r.stockState === "LOW"
              ? "text-hazard"
              : "text-ink")
        }
      >
        {r.available}
      </span>
    ),
  },
  {
    key: "reorderPoint",
    header: "Reorder pt",
    align: "right",
    render: (r) => (
      <span className="font-mono text-smoke">{r.reorderPoint ?? "—"}</span>
    ),
  },
  {
    key: "uom",
    header: "UoM",
    render: (r) => <span className="font-mono text-smoke">{r.uom}</span>,
  },
  {
    key: "stockState",
    header: "Status",
    align: "right",
    render: (r) => <StatusPill kind="stock" value={r.stockState} />,
  },
  {
    key: "manage",
    header: "Manage",
    align: "right",
    render: (r) => (
      <Button asChild variant="secondary" size="sm">
        <Link to="/inventory/$stockItemId" params={{ stockItemId: r.stockItemId }}>
          Manage
        </Link>
      </Button>
    ),
  },
];

export function InventoryListPage() {
  // "all" maps to no backend filter; "low"/"out" pass through.
  const [filter, setFilter] = useState("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [q, setQ] = useState("");
  // The committed search term (search box only applies on submit).
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useInventory({
    filter: filter === "all" ? undefined : filter,
    q: committedQ || undefined,
    warehouseId: warehouseId || undefined,
    page,
    take: TAKE,
  });

  const { data: warehouses } = useWarehouseOptions();

  const tabs: PageHeaderTab[] = [
    { label: "All", value: "all", active: filter === "all" },
    { label: "Low", value: "low", active: filter === "low" },
    { label: "Out", value: "out", active: filter === "out" },
  ];

  const activeWarehouse =
    warehouses?.find((w) => w.id === warehouseId) ?? null;
  const scopeNote = activeWarehouse
    ? `Per-warehouse view: ${activeWarehouse.name}.`
    : "Combined view across all warehouses (global rollup).";

  const hasFilters = committedQ !== "" || filter !== "all" || warehouseId !== "";

  function clearFilters() {
    setFilter("all");
    setWarehouseId("");
    setQ("");
    setCommittedQ("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description={`Stock levels across variants and raw materials. ${scopeNote}`}
        tabs={tabs}
        onTabChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
      />

      <form
        className="flex w-full max-w-2xl flex-wrap items-stretch gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCommittedQ(q.trim());
          setPage(1);
        }}
      >
        <select
          name="warehouseId"
          value={warehouseId}
          aria-label="Warehouse"
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setPage(1);
          }}
          className="border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem] text-ink shadow-press outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <option value="">All warehouses</option>
          {(warehouses ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code})
            </option>
          ))}
        </select>
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-smoke"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or SKU…"
            aria-label="Search inventory"
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
          title="Could not load inventory"
          description="Something went wrong fetching stock levels. Try again."
        />
      ) : (
        <>
          <DataTable<InventoryRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.stockItemId}
            empty={
              <EmptyState
                icon={<Boxes className="size-6" aria-hidden="true" />}
                title="No items found"
                description={
                  hasFilters
                    ? "No inventory matches these filters. Try clearing the search or filter."
                    : "Inventory items will appear here once products are stocked."
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
