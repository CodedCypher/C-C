/**
 * circuit.rocks — branches feature: detail page (route /branches/$branchId).
 *
 * Reads the `branchId` param, loads the branch via `useBranch`, and renders:
 *   - a PageHeader (name + code + city) with a back link and an "Edit" action
 *   - the address block
 *   - a "Linked warehouses" panel (table of links: priority + default badge)
 *     with a "Manage links" action (opens the link-manager Sheet)
 *   - a "Branch inventory" DataTable: the derived rollup across the branch's
 *     linked warehouses (GET /branches/:id/inventory) with all/low/out tabs +
 *     search + pagination; columns item / per-warehouse breakdown (mono chips) /
 *     on hand / available (colored) / StatusPill
 *
 * When the branch has no linked warehouses, the inventory section shows a
 * teaching empty state ("Link a warehouse to see branch inventory") and skips
 * the query entirely (no point asking for a rollup with no sources).
 *
 * The Edit form and the link manager both live in right-side Sheets (NOT
 * modals). The route isn't registered in the typed router yet (a later task
 * wires it), so we read the param with `useParams({ strict: false })`.
 */

import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Search, Store } from "lucide-react";

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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

import { useBranch, useBranchInventory } from "../hooks/use-branches";
import { warehouseTypeLabel } from "../lib/warehouse-type";
import type {
  BranchDetail,
  BranchInventoryRow,
  BranchWarehouseLink,
} from "../types/branches.types";
import { BranchFormSheet } from "../components/branch-form-sheet";
import { BranchLinksSheet } from "../components/branch-links-sheet";

const TAKE = 20;

/* ------------------------------------------------------------------ *
 * Linked-warehouses panel
 * ------------------------------------------------------------------ */

const linkColumns: Column<BranchWarehouseLink>[] = [
  {
    key: "name",
    header: "Warehouse",
    render: (l) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{l.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">
          {l.code} · {warehouseTypeLabel(l.type)}
        </span>
      </div>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    align: "right",
    render: (l) => <span className="font-mono text-ink">{l.priority}</span>,
  },
  {
    key: "isDefault",
    header: "Default",
    align: "right",
    render: (l) =>
      l.isDefault ? (
        <Badge variant="signal" size="sm">
          Default
        </Badge>
      ) : (
        <span className="font-mono text-[0.75rem] text-smoke">—</span>
      ),
  },
];

/* ------------------------------------------------------------------ *
 * Branch inventory columns (derived rollup + per-warehouse chips)
 * ------------------------------------------------------------------ */

const inventoryColumns: Column<BranchInventoryRow>[] = [
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
    key: "byWarehouse",
    header: "By warehouse",
    render: (r) =>
      r.byWarehouse.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {r.byWarehouse.map((w) => (
            <span
              key={w.warehouseId}
              className="inline-flex items-center gap-1 border-2 border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none text-ink"
              title={`${w.code}: ${w.onHand} on hand`}
            >
              <span className="uppercase tracking-[0.06em] text-smoke">
                {w.code}
              </span>
              <span className="font-bold">{w.onHand}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="font-mono text-[0.75rem] text-smoke">—</span>
      ),
  },
  {
    key: "onHand",
    header: "On hand",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.onHand}</span>,
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
    key: "stockState",
    header: "Status",
    align: "right",
    render: (r) => <StatusPill kind="stock" value={r.stockState} />,
  },
];

/* ------------------------------------------------------------------ *
 * Address block
 * ------------------------------------------------------------------ */

function AddressBlock({ branch }: { branch: BranchDetail }) {
  const lines = [
    branch.line1,
    branch.line2,
    [branch.city, branch.region, branch.postalCode].filter(Boolean).join(", "),
    branch.country,
  ].filter((l): l is string => Boolean(l && l.trim()));

  const hasAddress = lines.length > 0 || Boolean(branch.phone || branch.email);

  return (
    <div className="flex flex-col gap-2 border-2 border-line bg-paper px-4 py-3 shadow-press">
      <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
        Contact &amp; address
      </span>
      {hasAddress ? (
        <div className="flex flex-col gap-0.5">
          {lines.map((l, i) => (
            <span key={i} className="text-[0.875rem] text-ink">
              {l}
            </span>
          ))}
          {branch.email ? (
            <span className="mt-1 font-mono text-[0.8125rem] text-smoke">
              {branch.email}
            </span>
          ) : null}
          {branch.phone ? (
            <span className="font-mono text-[0.8125rem] text-smoke">
              {branch.phone}
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-[0.875rem] text-smoke">
          No contact or address on file. Use Edit to add details.
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function BranchDetailPage() {
  // The route (`/branches/$branchId`) is wired in a later task; read the param
  // non-strictly so this compiles before the route is registered.
  const params = useParams({ strict: false });
  const branchId = (params as { branchId?: string }).branchId ?? "";

  const { data: branch, isLoading, isError } = useBranch(branchId);

  const [editOpen, setEditOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  // Branch-inventory sub-list filters (mirror the inventory list page).
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  const hasLinks = (branch?.warehouses.length ?? 0) > 0;

  const { data: inventory, isLoading: inventoryLoading } = useBranchInventory(
    // Skip the query entirely when there are no linked warehouses.
    hasLinks ? branchId : "",
    {
      filter: filter === "all" ? undefined : filter,
      q: committedQ || undefined,
      page,
      take: TAKE,
    },
  );

  const backLink = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/branches">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Branches
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  if (isError || !branch) {
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        <EmptyState
          icon={<Store className="size-6" aria-hidden="true" />}
          title="Could not load this branch"
          description="The branch could not be found, or something went wrong fetching it. Go back to the list and try again."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/branches">Back to branches</Link>
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

  const description = [
    `Code ${branch.code}`,
    branch.city ?? null,
    branch.isActive ? null : "inactive",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      {backLink}

      <PageHeader
        title={branch.name}
        description={description}
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        }
      />

      {/* Identity badges */}
      <div className="flex flex-wrap items-center gap-2">
        {branch.isActive ? (
          <Badge variant="stock" size="sm">
            Active
          </Badge>
        ) : (
          <Badge variant="soldout" size="sm">
            Inactive
          </Badge>
        )}
      </div>

      <AddressBlock branch={branch} />

      {/* Linked warehouses */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
            Linked warehouses
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLinksOpen(true)}
          >
            Manage links
          </Button>
        </div>

        <DataTable<BranchWarehouseLink>
          columns={linkColumns}
          rows={branch.warehouses}
          getRowKey={(l) => l.id}
          empty={
            <EmptyState
              icon={<Store className="size-6" aria-hidden="true" />}
              title="No warehouses linked"
              description="Link one or more warehouses to source this branch's stock. The default warehouse fulfils its sales first."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setLinksOpen(true)}
                >
                  Manage links
                </Button>
              }
            />
          }
        />
      </section>

      {/* Branch inventory (derived rollup) */}
      <section className="flex flex-col gap-4">
        <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
          Branch inventory
        </h2>

        {!hasLinks ? (
          <EmptyState
            icon={<Store className="size-6" aria-hidden="true" />}
            title="Link a warehouse to see branch inventory"
            description="Branch inventory is a rollup across this branch's linked warehouses. Link at least one warehouse to populate it."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setLinksOpen(true)}
              >
                Manage links
              </Button>
            }
          />
        ) : (
          <>
            <PageHeader
              title=""
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
                  aria-label="Search branch inventory"
                  className="w-full border-2 border-line bg-paper py-2.5 pl-9 pr-3 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink"
                />
              </div>
              <Button type="submit" variant="primary" size="md">
                Search
              </Button>
            </form>

            {inventoryLoading ? (
              <TableSkeleton rows={8} cols={inventoryColumns.length} />
            ) : (
              <>
                <DataTable<BranchInventoryRow>
                  columns={inventoryColumns}
                  rows={inventory?.rows ?? []}
                  getRowKey={(r) => r.stockItemId}
                  empty={
                    <EmptyState
                      icon={<Store className="size-6" aria-hidden="true" />}
                      title="No inventory found"
                      description={
                        hasFilters
                          ? "No items match these filters. Try clearing the search or filter."
                          : "The linked warehouses hold no stock yet. Stock appears here once items are received or adjusted in."
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
                  take={inventory?.take ?? TAKE}
                  total={inventory?.total ?? 0}
                  onPageChange={setPage}
                />
              </>
            )}
          </>
        )}
      </section>

      <BranchFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={branch}
      />

      <BranchLinksSheet
        open={linksOpen}
        onOpenChange={setLinksOpen}
        branch={branch}
      />
    </div>
  );
}
