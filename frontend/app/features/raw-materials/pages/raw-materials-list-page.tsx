/**
 * circuit.rocks — raw-materials feature: list page (route /raw-materials).
 *
 * Mirrors the inventory list page: filter tabs (All/Low/Out) + a search box
 * drive `useRawMaterials({ filter, q, page, take })`; filters live in local
 * state and are part of the query key, so changing one refetches + caches.
 *
 * Writes are surfaced through two right-side Sheets (NOT modals):
 *   - the create/edit form Sheet (RawMaterialFormSheet)
 *   - the detail Sheet (RawMaterialDetailSheet) with Edit + inline-confirm Delete
 *
 * CANONICAL PATTERN for a list page:
 *   - hold filter state locally; read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { FlaskConical, Search } from "lucide-react";

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
import { cn } from "~/lib/utils";
import { peso } from "~/lib/format";
import { useRawMaterials } from "../hooks/use-raw-materials";
import { RawMaterialDetailSheet } from "../components/raw-material-detail-sheet";
import { RawMaterialFormSheet } from "../components/raw-material-form-sheet";
import type {
  RawMaterialDetail,
  RawMaterialRow,
} from "../types/raw-materials.types";

const TAKE = 20;

function availableClass(state: RawMaterialRow["stockState"]): string {
  if (state === "OUT") return "text-soldout";
  if (state === "LOW") return "text-hazard";
  return "text-ink";
}

export function RawMaterialsListPage() {
  // "all" maps to no backend filter; "low"/"out" pass through.
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  // The committed search term (search box only applies on submit).
  const [committedQ, setCommittedQ] = useState("");
  const [page, setPage] = useState(1);

  // Sheet state: which material is open in the detail Sheet, and whether the
  // create/edit form Sheet is open (with the material being edited, if any).
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterialDetail | null>(null);

  const { data, isLoading, isError } = useRawMaterials({
    filter: filter === "all" ? undefined : filter,
    q: committedQ || undefined,
    page,
    take: TAKE,
  });

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

  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(material: RawMaterialDetail) {
    setEditing(material);
    setDetailOpen(false);
    setFormOpen(true);
  }

  const columns: Column<RawMaterialRow>[] = [
    {
      key: "name",
      header: "Material",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{r.name}</span>
          <span className="font-mono text-[0.75rem] text-smoke">{r.sku}</span>
        </div>
      ),
    },
    {
      key: "uom",
      header: "UoM",
      render: (r) => <span className="font-mono text-smoke">{r.uom}</span>,
    },
    {
      key: "standardCost",
      header: "Std cost",
      align: "right",
      render: (r) => (
        <span className="font-mono text-ink">
          {r.standardCost == null ? "—" : peso(r.standardCost)}
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
      key: "available",
      header: "Available",
      align: "right",
      render: (r) => (
        <span className={cn("font-mono font-bold", availableClass(r.stockState))}>
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
      key: "stockState",
      header: "Status",
      render: (r) => <StatusPill kind="stock" value={r.stockState} />,
    },
    {
      key: "manage",
      header: "",
      align: "right",
      render: (r) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => openDetail(r.id)}
        >
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Raw Materials"
        description="Components and consumables stocked for assembly. Track cost, reorder policy and per-warehouse levels."
        tabs={tabs}
        onTabChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        actions={
          <Button type="button" variant="primary" size="md" onClick={openCreate}>
            New material
          </Button>
        }
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
            aria-label="Search raw materials"
            className="w-full border-2 border-line bg-paper py-2.5 pl-9 pr-3 font-mono text-[0.8125rem] text-ink shadow-press outline-none transition-colors duration-150 placeholder:text-smoke hover:border-ink focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
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
          icon={<FlaskConical className="size-6" aria-hidden="true" />}
          title="Could not load raw materials"
          description="Something went wrong fetching materials. Try again."
        />
      ) : (
        <>
          <DataTable<RawMaterialRow>
            columns={columns}
            rows={data?.rows ?? []}
            getRowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<FlaskConical className="size-6" aria-hidden="true" />}
                title={hasFilters ? "No materials found" : "No raw materials yet"}
                description={
                  hasFilters
                    ? "No materials match these filters. Try clearing the search or filter."
                    : "Raw materials are the components you assemble products from. Add your first one to start tracking cost and stock."
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
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={openCreate}
                    >
                      New material
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

      {/* Detail Sheet — view + edit/delete affordances. */}
      <RawMaterialDetailSheet
        materialId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onDeleted={() => {
          setDetailOpen(false);
          setDetailId(null);
        }}
      />

      {/* Create / edit form Sheet. */}
      <RawMaterialFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        material={editing}
        onSaved={(id) => {
          // After editing, hand the user back to the (now-fresh) detail view.
          if (editing) {
            setDetailId(id);
            setDetailOpen(true);
          }
          setEditing(null);
        }}
      />
    </div>
  );
}
