/**
 * circuit.rocks — transfers feature: detail page (route /transfers/$transferId).
 *
 * Shows a transfer's header (number, status, source → dest), notes and lines,
 * plus a status-driven action bar:
 *   DRAFT      → Request · Ship · Cancel
 *   REQUESTED  → Ship · Cancel
 *   IN_TRANSIT / PARTIALLY_RECEIVED → Receive (Sheet) · Cancel
 *   RECEIVED / CANCELLED → terminal (no actions)
 *
 * Each action calls its mutation (which invalidates the detail + list), and any
 * 409/400 (e.g. ship with insufficient source stock) is surfaced via
 * `unwrapFieldErrors`.
 */

import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Truck } from "lucide-react";

import {
  DataTable,
  EmptyState,
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
import { formatDate } from "~/lib/format";
import { useTransfer } from "../hooks/use-transfer";
import {
  useCancelTransfer,
  useReceiveTransfer,
  useRequestTransfer,
  useShipTransfer,
} from "../hooks/use-transfer-actions";
import { CellInput, labelClass } from "../components/fields";
import type { TransferLine } from "../types/transfers.types";

const lineColumns: Column<TransferLine>[] = [
  {
    key: "item",
    header: "Item",
    render: (l) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{l.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">
          {l.sku} · {l.uom}
        </span>
      </div>
    ),
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (l) => <span className="font-mono text-ink">{l.quantity}</span>,
  },
  {
    key: "qtyShipped",
    header: "Shipped",
    align: "right",
    render: (l) => <span className="font-mono text-smoke">{l.qtyShipped}</span>,
  },
  {
    key: "qtyReceived",
    header: "Received",
    align: "right",
    render: (l) => (
      <span className="font-mono font-bold text-ink">{l.qtyReceived}</span>
    ),
  },
];

export function TransferDetailPage() {
  const { transferId } = useParams({ strict: false }) as {
    transferId: string;
  };
  const { data, isLoading, isError } = useTransfer(transferId);

  const request = useRequestTransfer(transferId);
  const ship = useShipTransfer(transferId);
  const cancel = useCancelTransfer(transferId);
  const receive = useReceiveTransfer(transferId);

  const [actionError, setActionError] = useState<string[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  // Per-line received quantities while the Receive sheet is open.
  const [recvQty, setRecvQty] = useState<Record<string, string>>({});

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

  function openReceive() {
    if (!data) return;
    const seed: Record<string, string> = {};
    for (const l of data.lines) {
      const outstanding = l.qtyShipped - l.qtyReceived;
      seed[l.id] = outstanding > 0 ? String(outstanding) : "0";
    }
    setRecvQty(seed);
    setActionError([]);
    setReceiveOpen(true);
  }

  async function submitReceive() {
    if (!data) return;
    const lines = data.lines
      .map((l) => ({ lineId: l.id, qtyReceived: (recvQty[l.id] ?? "").trim() }))
      .filter((l) => l.qtyReceived !== "" && Number(l.qtyReceived) > 0);
    if (lines.length === 0) {
      setActionError(["Enter a received quantity for at least one line."]);
      return;
    }
    try {
      await receive.mutateAsync({ lines });
      setReceiveOpen(false);
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      setActionError(
        mapped?.formErrors.length
          ? mapped.formErrors
          : mapped
            ? Object.values(mapped.fieldErrors).flat()
            : ["Could not receive the transfer. Try again."],
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
        icon={<Truck className="size-6" aria-hidden="true" />}
        title="Transfer not found"
        description="This transfer could not be loaded. It may have been removed."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/transfers">Back to transfers</Link>
          </Button>
        }
      />
    );
  }

  const status = data.status;
  const busy =
    request.isPending ||
    ship.isPending ||
    cancel.isPending ||
    receive.isPending;
  const canRequest = status === "DRAFT";
  const canShip = status === "DRAFT" || status === "REQUESTED";
  const canReceive = status === "IN_TRANSIT" || status === "PARTIALLY_RECEIVED";
  const canCancel = status !== "RECEIVED" && status !== "CANCELLED";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={data.transferNumber}
        description={`Created ${formatDate(data.createdAt)}${data.notes ? ` · ${data.notes}` : ""}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/transfers">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-2 border-line bg-paper px-4 py-3 shadow-press">
        <StatusPill kind="transfer" value={status} />
        <span className="inline-flex items-center gap-2 font-mono text-[0.875rem] text-ink">
          <span title={data.sourceWarehouse.name}>
            {data.sourceWarehouse.code}
          </span>
          <ArrowRight className="size-4 text-smoke" aria-hidden="true" />
          <span title={data.destWarehouse.name}>
            {data.destWarehouse.code}
          </span>
        </span>
        {data.shippedAt ? (
          <span className="font-mono text-[0.75rem] text-smoke">
            Shipped {formatDate(data.shippedAt)}
          </span>
        ) : null}
        {data.receivedAt ? (
          <span className="font-mono text-[0.75rem] text-smoke">
            Received {formatDate(data.receivedAt)}
          </span>
        ) : null}
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
      {canRequest || canShip || canReceive || canCancel ? (
        <div className="flex flex-wrap items-center gap-2">
          {canRequest ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => request.mutateAsync())}
            >
              Request
            </Button>
          ) : null}
          {canShip ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => ship.mutateAsync())}
            >
              Ship
            </Button>
          ) : null}
          {canReceive ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={openReceive}
            >
              Receive
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
              Cancel transfer
            </Button>
          ) : null}
        </div>
      ) : null}

      <DataTable<TransferLine>
        columns={lineColumns}
        rows={data.lines}
        getRowKey={(l) => l.id}
      />

      {/* Receive Sheet */}
      <Sheet open={receiveOpen} onOpenChange={setReceiveOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Receive transfer</SheetTitle>
            <SheetDescription>
              Record received quantities per line. Defaults to the outstanding
              shipped amount.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-6">
            {data.lines.map((l) => {
              const outstanding = l.qtyShipped - l.qtyReceived;
              return (
                <label key={l.id} className="flex flex-col gap-1.5">
                  <span className={labelClass}>
                    {l.name} · {l.sku}
                  </span>
                  <span className="font-mono text-[0.6875rem] text-smoke">
                    Shipped {l.qtyShipped} · received {l.qtyReceived} ·
                    outstanding {outstanding > 0 ? outstanding : 0}
                  </span>
                  <CellInput
                    inputMode="decimal"
                    aria-label={`Received quantity for ${l.sku}`}
                    value={recvQty[l.id] ?? ""}
                    onChange={(e) =>
                      setRecvQty((m) => ({ ...m, [l.id]: e.target.value }))
                    }
                  />
                </label>
              );
            })}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={receive.isPending}
              onClick={submitReceive}
            >
              {receive.isPending ? "Receiving…" : "Confirm receipt"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
