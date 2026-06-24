/**
 * circuit.rocks — warehouses feature: detail page (route /warehouses/$warehouseId).
 *
 * Maps to the router route `/warehouses/$warehouseId` (param `warehouseId`).
 * Reads the param, loads the warehouse via `useWarehouse`, and renders:
 *   - a PageHeader (name + code + type badge + "Web default" badge) with a back
 *     link to /warehouses and an "Edit" action (opens the edit Sheet)
 *   - the address block
 *   - a KPI row of MetricCards (items / low / out)
 *   - the per-warehouse stock DataTable (GET /warehouses/:id/stock) with
 *     all/low/out tabs + search + pagination (mirrors the inventory list page).
 *     Stock rows link to /inventory/$stockItemId.
 *
 * The create/edit form lives in a right-side Sheet (NOT a modal). Both the list
 * page (create) and this page (edit) reuse `WarehouseFormSheet`. The route isn't
 * registered in the typed router yet (a later task wires it), so we read the
 * param with `useParams({ strict: false })` to stay type-safe.
 */

import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Search, Trash2, Warehouse } from "lucide-react";

import {
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  Pagination,
  StatusPill,
  TableSkeleton,
  type Column,
  type PageHeaderTab,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";

import {
  useWarehouse,
  useWarehouseStock,
  useDeleteWarehouse,
} from "../hooks/use-warehouses";
import { warehouseTypeLabel } from "../types/warehouses.types";
import type {
  WarehouseDetail,
  WarehouseStockRow,
} from "../types/warehouses.types";
import { WarehouseFormSheet } from "../components/warehouse-form-sheet";
import { FormErrors } from "../components/fields";

const TAKE = 20;

/* ------------------------------------------------------------------ *
 * Per-warehouse stock columns
 * ------------------------------------------------------------------ */

const stockColumns: Column<WarehouseStockRow>[] = [
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
];

/* ------------------------------------------------------------------ *
 * Address block
 * ------------------------------------------------------------------ */

function AddressBlock({ warehouse }: { warehouse: WarehouseDetail }) {
  const lines = [
    warehouse.line1,
    warehouse.line2,
    [warehouse.city, warehouse.region, warehouse.postalCode]
      .filter(Boolean)
      .join(", "),
    warehouse.country,
  ].filter((l): l is string => Boolean(l && l.trim()));

  const hasAddress = lines.length > 0 || Boolean(warehouse.phone);

  return (
    <div className="flex flex-col gap-2 border-2 border-line bg-paper px-4 py-3 shadow-press">
      <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
        Address
      </span>
      {hasAddress ? (
        <div className="flex flex-col gap-0.5">
          {lines.map((l, i) => (
            <span key={i} className="text-[0.875rem] text-ink">
              {l}
            </span>
          ))}
          {warehouse.phone ? (
            <span className="mt-1 font-mono text-[0.8125rem] text-smoke">
              {warehouse.phone}
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-[0.875rem] text-smoke">
          No address on file. Use Edit to add one.
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Delete-confirmation Sheet (surfaces the structured 409)
 * ------------------------------------------------------------------ */

function DeleteWarehouseSheet({
  open,
  onOpenChange,
  warehouseId,
  warehouseName,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  warehouseName: string;
  onDeleted: () => void;
}) {
  const del = useDeleteWarehouse(warehouseId);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function handleDelete() {
    setFormErrors([]);
    try {
      await del.mutateAsync();
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      setFormErrors(
        mapped?.formErrors.length
          ? mapped.formErrors
          : mapped
            ? Object.values(mapped.fieldErrors).flat()
            : ["Could not delete this warehouse. Please try again."],
      );
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setFormErrors([]);
        onOpenChange(o);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Delete warehouse</SheetTitle>
          <SheetDescription>
            Permanently remove{" "}
            <span className="font-bold">{warehouseName}</span>. This cannot be
            undone. A warehouse that still holds stock (on hand above zero
            anywhere) cannot be deleted.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6">
          <FormErrors errors={formErrors} />
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t-2 border-line">
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={del.isPending}
            onClick={handleDelete}
          >
            {del.isPending ? "Deleting…" : "Delete warehouse"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function WarehouseDetailPage() {
  // The route (`/warehouses/$warehouseId`) is wired in a later task; read the
  // param non-strictly so this compiles before the route is registered.
  const params = useParams({ strict: false });
  const warehouseId = (params as { warehouseId?: string }).warehouseId ?? "";
  const navigate = useNavigate();

  const { data: warehouse, isLoading, isError } = useWarehouse(warehouseId);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Stock sub-list filters (mirror the inventory list page).
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const { data: stock, isLoading: stockLoading } = useWarehouseStock(
    warehouseId,
    {
      filter: filter === "all" ? undefined : filter,
      q: committedQ || undefined,
      page,
      take: TAKE,
    },
  );

  const backLink = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/warehouses">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Warehouses
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  if (isError || !warehouse) {
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        <EmptyState
          icon={<Warehouse className="size-6" aria-hidden="true" />}
          title="Could not load this warehouse"
          description="The warehouse could not be found, or something went wrong fetching it. Go back to the list and try again."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/warehouses">Back to warehouses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const tabs: PageHeaderTab[] = [
    { label: "All", value: "all", active: filter === "all" },
    { label: "Low", value: "low", active: filter === "low" },
    { label: "Out", value: "out", active: filter === "out" },
  ];

  const hasFilters = committedQ !== "" || filter !== "all";

  function clearFilters() {
    setFilter("all");
    setQ("");
    setCommittedQ("");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      {backLink}

      <PageHeader
        title={warehouse.name}
        description={`Code ${warehouse.code}${warehouse.isActive ? "" : " · inactive"}`}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </>
        }
      />

      {/* Identity badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral" size="sm">
          {warehouseTypeLabel(warehouse.type)}
        </Badge>
        {warehouse.isDefaultWeb ? (
          <Badge variant="signal" size="sm">
            Web default
          </Badge>
        ) : null}
        {!warehouse.isActive ? (
          <Badge variant="soldout" size="sm">
            Inactive
          </Badge>
        ) : null}
      </div>

      <AddressBlock warehouse={warehouse} />

      {/* KPI row — stock summary. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Items" value={`${warehouse.stockSummary.itemCount}`} />
        <MetricCard label="Low" value={`${warehouse.stockSummary.lowCount}`} />
        <MetricCard
          label="Out"
          value={`${warehouse.stockSummary.outCount}`}
          accent={warehouse.stockSummary.outCount > 0}
        />
      </div>

      {/* Per-warehouse stock. */}
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Stock at this warehouse"
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
              aria-label="Search warehouse stock"
              className="w-full border-2 border-line bg-paper py-2.5 pl-9 pr-3 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Search
          </Button>
        </form>

        {stockLoading ? (
          <TableSkeleton rows={8} cols={stockColumns.length} />
        ) : (
          <>
            <DataTable<WarehouseStockRow>
              columns={stockColumns}
              rows={stock?.rows ?? []}
              getRowKey={(r) => r.stockItemId}
              empty={
                <EmptyState
                  icon={<Warehouse className="size-6" aria-hidden="true" />}
                  title="No stock found"
                  description={
                    hasFilters
                      ? "No stock at this warehouse matches these filters. Try clearing the search or filter."
                      : "This warehouse holds no stock yet. Stock appears here once items are received or adjusted in."
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
              take={stock?.take ?? TAKE}
              total={stock?.total ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <WarehouseFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={warehouse}
      />

      <DeleteWarehouseSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        warehouseId={warehouse.id}
        warehouseName={warehouse.name}
        onDeleted={() => navigate({ to: "/warehouses" })}
      />
    </div>
  );
}
