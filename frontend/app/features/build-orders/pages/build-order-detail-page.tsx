/**
 * circuit.rocks — build-orders feature: detail page
 * (route /build-orders/$buildOrderId).
 *
 * Shows a build order's header (product + sku + status + BOM version +
 * warehouse), a KPI row (planned / produced / cost), and a status-driven action
 * bar:
 *   DRAFT       → Plan · Cancel
 *   PLANNED     → Start · Complete · Cancel
 *   IN_PROGRESS → Complete · Cancel
 *   COMPLETED / CANCELLED → terminal (no actions)
 *
 * "Complete" opens a Sheet with a qtyProduced input (defaulting to qtyPlanned).
 * Each action calls its mutation (which invalidates the detail + list), and any
 * 409/400 (e.g. plan with unavailable components, or a complete shortfall) is
 * surfaced via `unwrapFieldErrors` in a banner.
 *
 * The BOM component requirements always show. Once COMPLETED, the consumptions
 * (materials drawn down) and outputs (finished goods + lots) tables show too.
 */

import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft, Factory } from "lucide-react";

import {
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";
import { peso, formatDate } from "~/lib/format";
import { useBuildOrder } from "../hooks/use-build-order";
import {
  useCancelBuildOrder,
  useCompleteBuildOrder,
  usePlanBuildOrder,
  useStartBuildOrder,
} from "../hooks/use-build-order-actions";
import { CellInput, labelClass } from "../components/fields";
import type {
  BuildOrderComponent,
  BuildOrderConsumption,
  BuildOrderOutput,
} from "../types/build-orders.types";

/* ----- Component requirements table (always shown) ----- */
const componentColumns: Column<BuildOrderComponent>[] = [
  {
    key: "item",
    header: "Component",
    render: (c) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{c.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">
          {c.sku} · {c.uom}
        </span>
      </div>
    ),
  },
  {
    key: "perUnit",
    header: "Per unit",
    align: "right",
    render: (c) => <span className="font-mono text-smoke">{c.perUnit}</span>,
  },
  {
    key: "requiredForPlanned",
    header: "Required",
    align: "right",
    render: (c) => (
      <span className="font-mono font-bold text-ink">
        {c.requiredForPlanned}
      </span>
    ),
  },
  {
    key: "scrapPct",
    header: "Scrap",
    align: "right",
    render: (c) => (
      <span className="font-mono text-smoke">
        {c.scrapPct == null ? "—" : `${c.scrapPct}%`}
      </span>
    ),
  },
];

/* ----- Consumptions table (shown once COMPLETED) ----- */
const consumptionColumns: Column<BuildOrderConsumption>[] = [
  {
    key: "item",
    header: "Component",
    render: (c) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{c.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{c.sku}</span>
      </div>
    ),
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (c) => <span className="font-mono text-ink">{c.quantity}</span>,
  },
  {
    key: "unitCost",
    header: "Unit cost",
    align: "right",
    render: (c) => (
      <span className="font-mono text-smoke">
        {c.unitCost == null ? "—" : peso(c.unitCost)}
      </span>
    ),
  },
  {
    key: "warehouseCode",
    header: "Warehouse",
    align: "right",
    render: (c) => (
      <span className="font-mono text-[0.8125rem] text-ink">
        {c.warehouseCode}
      </span>
    ),
  },
];

/* ----- Outputs table (shown once COMPLETED) ----- */
const outputColumns: Column<BuildOrderOutput>[] = [
  {
    key: "item",
    header: "Output",
    render: (o) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{o.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{o.sku}</span>
      </div>
    ),
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (o) => (
      <span className="font-mono font-bold text-ink">{o.quantity}</span>
    ),
  },
  {
    key: "computedUnitCost",
    header: "Unit cost",
    align: "right",
    render: (o) => (
      <span className="font-mono text-ink">{peso(o.computedUnitCost)}</span>
    ),
  },
  {
    key: "lotCode",
    header: "Lot",
    align: "right",
    render: (o) => (
      <span className="font-mono text-[0.8125rem] text-smoke">{o.lotCode}</span>
    ),
  },
];

export function BuildOrderDetailPage() {
  const { buildOrderId } = useParams({ strict: false }) as {
    buildOrderId: string;
  };
  const { data, isLoading, isError } = useBuildOrder(buildOrderId);

  const plan = usePlanBuildOrder(buildOrderId);
  const start = useStartBuildOrder(buildOrderId);
  const cancel = useCancelBuildOrder(buildOrderId);
  const complete = useCompleteBuildOrder(buildOrderId);

  const [actionError, setActionError] = useState<string[]>([]);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [qtyProduced, setQtyProduced] = useState("");

  async function runAction(fn: () => Promise<unknown>) {
    setActionError([]);
    try {
      await fn();
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      setActionError(
        mapped?.formErrors.length
          ? mapped.formErrors
          : mapped
            ? Object.values(mapped.fieldErrors).flat()
            : ["Action failed. Try again."],
      );
    }
  }

  function openComplete() {
    if (!data) return;
    // Default the produced quantity to whatever was planned.
    setQtyProduced(String(data.qtyPlanned));
    setActionError([]);
    setCompleteOpen(true);
  }

  async function submitComplete() {
    const value = qtyProduced.trim();
    if (value === "" || Number(value) <= 0) {
      setActionError(["Enter the produced quantity."]);
      return;
    }
    setActionError([]);
    try {
      await complete.mutateAsync({ qtyProduced: value });
      setCompleteOpen(false);
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      setActionError(
        mapped?.formErrors.length
          ? mapped.formErrors
          : mapped
            ? Object.values(mapped.fieldErrors).flat()
            : ["Could not complete the build. Try again."],
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Factory className="size-6" aria-hidden="true" />}
        title="Build order not found"
        description="This build order could not be loaded. It may have been removed."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/build-orders">Back to build orders</Link>
          </Button>
        }
      />
    );
  }

  const status = data.status;
  const busy =
    plan.isPending ||
    start.isPending ||
    cancel.isPending ||
    complete.isPending;
  const canPlan = status === "DRAFT";
  const canStart = status === "PLANNED";
  const canComplete = status === "PLANNED" || status === "IN_PROGRESS";
  const canCancel = status !== "COMPLETED" && status !== "CANCELLED";
  const isCompleted = status === "COMPLETED";

  // Show the completed output's unit cost when available, else fall back to "—".
  const outputUnitCost =
    data.outputs.length > 0 ? data.outputs[0].computedUnitCost : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={data.variant.title}
        description={`Created ${formatDate(data.createdAt)}${data.notes ? ` · ${data.notes}` : ""}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/build-orders">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-2 border-line bg-paper px-4 py-3 shadow-press">
        <StatusPill kind="build" value={status} />
        <span className="font-mono text-[0.8125rem] text-ink">
          {data.variant.sku}
        </span>
        <span className="font-mono text-[0.75rem] uppercase tracking-[0.06em] text-smoke">
          BOM v{data.bom.version}
        </span>
        <span
          className="font-mono text-[0.8125rem] text-ink"
          title={data.warehouse.name}
        >
          {data.warehouse.code}
        </span>
        {data.startedAt ? (
          <span className="font-mono text-[0.75rem] text-smoke">
            Started {formatDate(data.startedAt)}
          </span>
        ) : null}
        {data.completedAt ? (
          <span className="font-mono text-[0.75rem] text-smoke">
            Completed {formatDate(data.completedAt)}
          </span>
        ) : null}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Planned" value={`${data.qtyPlanned}`} />
        <MetricCard label="Produced" value={`${data.qtyProduced}`} accent />
        <MetricCard
          label="Unit cost"
          value={outputUnitCost == null ? "—" : peso(outputUnitCost)}
        />
      </div>

      {actionError.length > 0 ? (
        <div className="border-2 border-soldout bg-soldout/10 px-4 py-3">
          {actionError.map((m, i) => (
            <p key={i} className="font-mono text-[0.8125rem] text-soldout">
              {m}
            </p>
          ))}
        </div>
      ) : null}

      {/* Action bar */}
      {canPlan || canStart || canComplete || canCancel ? (
        <div className="flex flex-wrap items-center gap-2">
          {canPlan ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => plan.mutateAsync())}
            >
              Plan
            </Button>
          ) : null}
          {canStart ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => start.mutateAsync())}
            >
              Start
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={openComplete}
            >
              Complete
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => cancel.mutateAsync())}
            >
              Cancel build
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* BOM component requirements (always shown) */}
      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
          Components
        </h2>
        <DataTable<BuildOrderComponent>
          columns={componentColumns}
          rows={data.components}
          getRowKey={(c) => c.stockItemId}
          empty={
            <EmptyState
              icon={<Factory className="size-6" aria-hidden="true" />}
              title="No components on this BOM"
              description="This build's bill of materials has no component lines. Check the BOM definition for this variant."
            />
          }
        />
      </section>

      {/* Consumptions + outputs (shown once COMPLETED) */}
      {isCompleted ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
              Consumptions
            </h2>
            <DataTable<BuildOrderConsumption>
              columns={consumptionColumns}
              rows={data.consumptions}
              getRowKey={(c) => c.stockItemId}
              empty={
                <EmptyState
                  icon={<Factory className="size-6" aria-hidden="true" />}
                  title="No consumptions recorded"
                  description="No materials were drawn down for this build."
                />
              }
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-lg font-bold leading-tight tracking-[-0.01em] text-ink">
              Outputs
            </h2>
            <DataTable<BuildOrderOutput>
              columns={outputColumns}
              rows={data.outputs}
              getRowKey={(o) => o.lotCode}
              empty={
                <EmptyState
                  icon={<Factory className="size-6" aria-hidden="true" />}
                  title="No outputs recorded"
                  description="No finished goods were posted for this build."
                />
              }
            />
          </section>
        </>
      ) : null}

      {/* Complete Sheet */}
      <Sheet open={completeOpen} onOpenChange={setCompleteOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Complete build</SheetTitle>
            <SheetDescription>
              Record how many units were actually produced. Posts consumptions
              and finished-goods outputs, and computes the unit cost.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-6">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Quantity produced</span>
              <span className="font-mono text-[0.6875rem] text-smoke">
                Planned {data.qtyPlanned}
              </span>
              <CellInput
                inputMode="decimal"
                aria-label="Quantity produced"
                value={qtyProduced}
                onChange={(e) => setQtyProduced(e.target.value)}
              />
            </label>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={complete.isPending}
              onClick={submitComplete}
            >
              {complete.isPending ? "Completing…" : "Confirm completion"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
