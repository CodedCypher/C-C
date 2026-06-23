/**
 * circuit.rocks — inventory feature: item-detail page.
 *
 * Maps to the router route `/inventory/$stockItemId` (param name `stockItemId`).
 * Reads the param, loads the item via `useInventoryItem`, and renders:
 *   - a PageHeader (name + sku) with a back link to /inventory and the two
 *     primary actions ("Adjust stock", "Reorder settings")
 *   - a KPI row of MetricCards (on hand / reserved / available / incoming +
 *     standard cost)
 *   - a per-warehouse levels DataTable, each row with an "Adjust" button
 *     (opens the Adjust Sheet pre-filled to that warehouse) and a reorder editor
 *   - the movement-ledger DataTable
 *
 * Two right-side Sheets carry the forms (NOT modals): the Adjust Sheet
 * (warehouse / signed qty / note) and the global Reorder-settings Sheet. Forms
 * use local `useState` + `unwrapFieldErrors`; quantities are sent as STRINGS.
 *
 * The route isn't registered in the typed router yet (a later task wires it),
 * so we read the param with `useParams({ strict: false })` to stay type-safe.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Boxes, PencilLine } from "lucide-react";

import {
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  TableSkeleton,
  type Column,
} from "~/components/shared";
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
import { peso, formatDate } from "~/lib/format";
import { cn } from "~/lib/utils";

import { useInventoryItem } from "../hooks/use-inventory-item";
import { useAdjustStock } from "../hooks/use-adjust-stock";
import { useSetReorder, useSetWarehouseReorder } from "../hooks/use-set-reorder";
import type {
  InventoryDetail,
  InventoryMovement,
  InventoryWarehouseLevel,
} from "../types/inventory.types";

/* ------------------------------------------------------------------ *
 * Small form primitives (local to this page — brutalist field styles)
 * ------------------------------------------------------------------ */

const fieldClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";

const labelClass =
  "flex flex-col gap-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {errors.map((e, i) => (
        <li
          key={i}
          className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-soldout"
        >
          {e}
        </li>
      ))}
    </ul>
  );
}

function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-2 border-soldout bg-paper px-3 py-2.5 shadow-press"
    >
      <ul className="flex flex-col gap-0.5">
        {errors.map((e, i) => (
          <li
            key={i}
            className="font-mono text-[0.75rem] uppercase tracking-[0.06em] text-soldout"
          >
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Adjust-stock Sheet
 * ------------------------------------------------------------------ */

function AdjustStockSheet({
  open,
  onOpenChange,
  item,
  presetWarehouseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryDetail;
  /** When opened from a warehouse row, the select defaults to that warehouse. */
  presetWarehouseId?: string;
}) {
  const adjust = useAdjustStock(item.id);

  const [warehouseId, setWarehouseId] = useState("");
  const [qtyDelta, setQtyDelta] = useState("");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Reset the form whenever the sheet (re)opens, honouring the preset warehouse.
  useEffect(() => {
    if (open) {
      setWarehouseId(presetWarehouseId ?? item.warehouses[0]?.warehouseId ?? "");
      setQtyDelta("");
      setNote("");
      setFieldErrors({});
      setFormErrors([]);
    }
  }, [open, presetWarehouseId, item.warehouses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    if (!warehouseId) {
      setFieldErrors({ warehouseId: ["Choose a warehouse."] });
      return;
    }
    if (qtyDelta.trim() === "") {
      setFieldErrors({ qtyDelta: ["Enter a signed quantity, e.g. -5 or 12.5."] });
      return;
    }

    try {
      await adjust.mutateAsync({
        warehouseId,
        qtyDelta: qtyDelta.trim(),
        note: note.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        setFieldErrors(unwrapped.fieldErrors);
        setFormErrors(
          unwrapped.formErrors.length > 0
            ? unwrapped.formErrors
            : ["Adjustment rejected. Review the values and try again."],
        );
      } else {
        setFormErrors(["Could not post the adjustment. Please try again."]);
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Adjust stock</SheetTitle>
          <SheetDescription>
            Post a manual on-hand correction for {item.name}. Use a signed delta:
            negative removes, positive adds. The change posts to the movement
            ledger.
          </SheetDescription>
        </SheetHeader>

        <form
          id="adjust-stock-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6"
          onSubmit={handleSubmit}
        >
          <FormErrors errors={formErrors} />

          <label className={labelClass}>
            Warehouse
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Select a warehouse…
              </option>
              {item.warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name} ({w.code}) — on hand {w.onHand}
                </option>
              ))}
            </select>
            <FieldErrors errors={fieldErrors.warehouseId} />
          </label>

          <label className={labelClass}>
            Quantity delta ({item.uom})
            <input
              type="text"
              inputMode="decimal"
              value={qtyDelta}
              onChange={(e) => setQtyDelta(e.target.value)}
              placeholder="-5 or 12.5"
              className={fieldClass}
            />
            <FieldErrors errors={fieldErrors.qtyDelta} />
          </label>

          <label className={labelClass}>
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Reason for the adjustment…"
              className={cn(fieldClass, "resize-y")}
            />
            <FieldErrors errors={fieldErrors.note} />
          </label>
        </form>

        <SheetFooter className="flex-row justify-end gap-2 border-t-2 border-line">
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            form="adjust-stock-form"
            variant="primary"
            size="sm"
            disabled={adjust.isPending}
          >
            {adjust.isPending ? "Posting…" : "Post adjustment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ *
 * Reorder-settings Sheet (item-level OR per-warehouse override)
 *
 * Both endpoints share the SetReorder body and set all three fields together,
 * so this one sheet drives either target. `warehouse` null = item-level.
 * ------------------------------------------------------------------ */

interface ReorderTarget {
  /** null → item-level policy; otherwise a per-warehouse override. */
  warehouse: InventoryWarehouseLevel | null;
}

function ReorderSheet({
  open,
  onOpenChange,
  item,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryDetail;
  target: ReorderTarget | null;
}) {
  const setReorder = useSetReorder(item.id);
  const setWarehouseReorder = useSetWarehouseReorder(item.id);

  const perWarehouse = target?.warehouse ?? null;

  const [reorderPoint, setReorderPoint] = useState("");
  const [reorderQty, setReorderQty] = useState("");
  const [safetyStock, setSafetyStock] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Seed the form from current values whenever the sheet opens / target changes.
  useEffect(() => {
    if (!open) return;
    if (perWarehouse) {
      // Per-warehouse only overrides the reorder point; qty/safety are item-level.
      setReorderPoint(numToInput(perWarehouse.reorderPoint));
      setReorderQty(numToInput(item.reorderQty));
      setSafetyStock(numToInput(item.safetyStock));
    } else {
      setReorderPoint(numToInput(item.reorderPoint));
      setReorderQty(numToInput(item.reorderQty));
      setSafetyStock(numToInput(item.safetyStock));
    }
    setFieldErrors({});
    setFormErrors([]);
  }, [open, perWarehouse, item.reorderPoint, item.reorderQty, item.safetyStock]);

  const pending = setReorder.isPending || setWarehouseReorder.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    // All three override fields are set together; send every value to retain it.
    // Blank → null (clears the override).
    const body = {
      reorderPoint: inputToBody(reorderPoint),
      reorderQty: inputToBody(reorderQty),
      safetyStock: inputToBody(safetyStock),
    };

    try {
      if (perWarehouse) {
        await setWarehouseReorder.mutateAsync({
          warehouseId: perWarehouse.warehouseId,
          body,
        });
      } else {
        await setReorder.mutateAsync(body);
      }
      onOpenChange(false);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        setFieldErrors(unwrapped.fieldErrors);
        setFormErrors(
          unwrapped.formErrors.length > 0
            ? unwrapped.formErrors
            : ["Could not save. Review the values and try again."],
        );
      } else {
        setFormErrors(["Could not save reorder settings. Please try again."]);
      }
    }
  }

  const title = perWarehouse
    ? `Reorder · ${perWarehouse.code}`
    : "Reorder settings";
  const description = perWarehouse
    ? `Override the reorder policy for ${perWarehouse.name} (${perWarehouse.code}). Leave a field blank to clear that override.`
    : `Set the global reorder policy for ${item.name}. Leave a field blank to clear it.`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form
          id="reorder-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6"
          onSubmit={handleSubmit}
        >
          <FormErrors errors={formErrors} />

          <label className={labelClass}>
            Reorder point ({item.uom})
            <input
              type="text"
              inputMode="decimal"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              placeholder="e.g. 20"
              className={fieldClass}
            />
            <FieldErrors errors={fieldErrors.reorderPoint} />
          </label>

          <label className={labelClass}>
            Reorder quantity ({item.uom})
            <input
              type="text"
              inputMode="decimal"
              value={reorderQty}
              onChange={(e) => setReorderQty(e.target.value)}
              placeholder="e.g. 100"
              className={fieldClass}
            />
            <FieldErrors errors={fieldErrors.reorderQty} />
          </label>

          <label className={labelClass}>
            Safety stock ({item.uom})
            <input
              type="text"
              inputMode="decimal"
              value={safetyStock}
              onChange={(e) => setSafetyStock(e.target.value)}
              placeholder="e.g. 10"
              className={fieldClass}
            />
            <FieldErrors errors={fieldErrors.safetyStock} />
          </label>
        </form>

        <SheetFooter className="flex-row justify-end gap-2 border-t-2 border-line">
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            form="reorder-form"
            variant="primary"
            size="sm"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Number|null → text input value ("" for null). */
function numToInput(n: number | null): string {
  return n == null ? "" : String(n);
}

/** Text input value → SetReorder body field (blank → null to clear). */
function inputToBody(raw: string): string | null {
  const t = raw.trim();
  return t === "" ? null : t;
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function InventoryItemPage() {
  // The route (`/inventory/$stockItemId`) is wired in a later task; read the
  // param non-strictly so this compiles before the route is registered.
  const params = useParams({ strict: false });
  const stockItemId = (params as { stockItemId?: string }).stockItemId ?? "";

  const { data: item, isLoading, isError } = useInventoryItem(stockItemId);

  // Sheet state: the Adjust sheet (optionally pre-filled to a warehouse) and
  // the Reorder sheet (item-level when target.warehouse is null).
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPreset, setAdjustPreset] = useState<string | undefined>(
    undefined,
  );
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<ReorderTarget | null>(
    null,
  );

  function openAdjust(presetWarehouseId?: string) {
    setAdjustPreset(presetWarehouseId);
    setAdjustOpen(true);
  }

  function openReorder(warehouse: InventoryWarehouseLevel | null) {
    setReorderTarget({ warehouse });
    setReorderOpen(true);
  }

  const backLink = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/inventory">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Inventory
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

  if (isError || !item) {
    return (
      <div className="flex flex-col gap-6">
        {backLink}
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden="true" />}
          title="Could not load this item"
          description="The stock item could not be found, or something went wrong fetching it. Go back to the inventory list and try again."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/inventory">Back to inventory</Link>
            </Button>
          }
        />
      </div>
    );
  }

  /* ----- Per-warehouse levels table ----- */
  const warehouseColumns: Column<InventoryWarehouseLevel>[] = [
    {
      key: "warehouse",
      header: "Warehouse",
      render: (w) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{w.name}</span>
          <span className="font-mono text-[0.75rem] text-smoke">{w.code}</span>
        </div>
      ),
    },
    {
      key: "onHand",
      header: "On hand",
      align: "right",
      render: (w) => <span className="font-mono text-ink">{w.onHand}</span>,
    },
    {
      key: "reserved",
      header: "Reserved",
      align: "right",
      render: (w) => <span className="font-mono text-smoke">{w.reserved}</span>,
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      render: (w) => (
        <span className="font-mono font-bold text-ink">{w.available}</span>
      ),
    },
    {
      key: "incoming",
      header: "Incoming",
      align: "right",
      render: (w) => <span className="font-mono text-smoke">{w.incoming}</span>,
    },
    {
      key: "reorderPoint",
      header: "Reorder pt",
      align: "right",
      render: (w) => (
        <span className="font-mono text-smoke">{w.reorderPoint ?? "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "Manage",
      align: "right",
      render: (w) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => openAdjust(w.warehouseId)}
          >
            Adjust
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openReorder(w)}
            aria-label={`Edit reorder point for ${w.code}`}
          >
            <PencilLine className="size-4" aria-hidden="true" />
            Reorder
          </Button>
        </div>
      ),
    },
  ];

  /* ----- Movement ledger table ----- */
  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: "createdAt",
      header: "Date",
      render: (m) => (
        <span className="font-mono text-[0.8125rem] text-smoke">
          {formatDate(m.createdAt)}
        </span>
      ),
    },
    {
      key: "warehouse",
      header: "Warehouse",
      render: (m) => (
        <span className="font-mono text-[0.8125rem] text-ink">
          {m.warehouseCode}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (m) => <span className="text-ink">{m.reason}</span>,
    },
    {
      key: "qtyDelta",
      header: "Qty Δ",
      align: "right",
      render: (m) => (
        <span
          className={cn(
            "font-mono font-bold",
            m.qtyDelta > 0
              ? "text-stock"
              : m.qtyDelta < 0
                ? "text-soldout"
                : "text-smoke",
          )}
        >
          {m.qtyDelta > 0 ? "+" : ""}
          {m.qtyDelta}
        </span>
      ),
    },
    {
      key: "note",
      header: "Note",
      render: (m) => (
        <span className="text-[0.8125rem] text-smoke">{m.note ?? "—"}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {backLink}

      <PageHeader
        title={item.name}
        description={`${item.kind === "VARIANT" ? "Variant" : "Material"} · ${item.sku} · per-unit ${item.uom}`}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openReorder(null)}
            >
              Reorder settings
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => openAdjust(undefined)}
            >
              Adjust stock
            </Button>
          </>
        }
      />

      {/* KPI row — global rollup buckets + standard cost. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="On hand" value={`${item.onHand}`} />
        <MetricCard label="Reserved" value={`${item.reserved}`} />
        <MetricCard label="Available" value={`${item.available}`} accent />
        <MetricCard label="Incoming" value={`${item.incoming}`} />
        <MetricCard
          label="Standard cost"
          value={item.standardCost == null ? "—" : peso(item.standardCost)}
        />
      </div>

      {/* Per-warehouse levels. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
          By warehouse
        </h2>
        <DataTable<InventoryWarehouseLevel>
          columns={warehouseColumns}
          rows={item.warehouses}
          getRowKey={(w) => w.warehouseId}
          empty={
            <EmptyState
              icon={<Boxes className="size-6" aria-hidden="true" />}
              title="No warehouse buckets yet"
              description="This item has no per-warehouse stock records. Post an adjustment to create one."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openAdjust(undefined)}
                >
                  Adjust stock
                </Button>
              }
            />
          }
        />
      </section>

      {/* Movement ledger. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
          Movement ledger
        </h2>
        <DataTable<InventoryMovement>
          columns={movementColumns}
          rows={item.movements}
          getRowKey={(m) => m.id}
          empty={
            <EmptyState
              icon={<Boxes className="size-6" aria-hidden="true" />}
              title="No movements recorded"
              description="Every stock adjustment, transfer and build posts a signed entry here. Post your first adjustment to start the ledger."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openAdjust(undefined)}
                >
                  Adjust stock
                </Button>
              }
            />
          }
        />
      </section>

      <AdjustStockSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        item={item}
        presetWarehouseId={adjustPreset}
      />
      <ReorderSheet
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        item={item}
        target={reorderTarget}
      />
    </div>
  );
}
