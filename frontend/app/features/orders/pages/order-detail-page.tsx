/**
 * circuit.rocks — orders feature: order detail page (route /orders/$orderId).
 *
 * The comprehensive order-management view: customer + address, line items,
 * manual-payment proof (upload → verify/reject), delivery fulfillment, and a
 * 4-step stepper (Pending → Paid → Shipped → Delivered). A status-driven action
 * bar exposes only the transitions valid for the current status:
 *   PENDING   → upload proof · verify · reject · cancel
 *   CONFIRMED → ship (warehouse override sheet) · cancel
 *   FULFILLED → mark delivered
 *   terminal (COMPLETED / CANCELLED / REFUNDED) → read-only
 *
 * Every action calls its mutation (which invalidates detail + list); 409/400
 * (e.g. ship with insufficient stock) is surfaced via `unwrapFieldErrors`.
 */

import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ShoppingCart,
  Truck,
  Upload,
  XCircle,
} from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { assetUrl, unwrapFieldErrors } from "~/lib/axios";
import { formatDate, peso } from "~/lib/format";
import { useOrder, useWarehouseOptions } from "../hooks/use-orders";
import {
  useCancelOrder,
  useDeliverOrder,
  useRejectPayment,
  useShipOrder,
  useUploadPaymentProof,
  useVerifyPayment,
} from "../hooks/use-order-actions";
import { OrderStepper } from "../components/order-stepper";
import type { OrderAddress, OrderLineInfo } from "../types/orders.types";

const inputClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";
const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

const lineColumns: Column<OrderLineInfo>[] = [
  {
    key: "item",
    header: "Item",
    render: (l) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{l.title}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{l.sku}</span>
      </div>
    ),
  },
  {
    key: "unitPrice",
    header: "Unit",
    align: "right",
    render: (l) => <span className="font-mono text-smoke">{peso(l.unitPrice)}</span>,
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (l) => <span className="font-mono text-ink">{l.quantity}</span>,
  },
  {
    key: "qtyFulfilled",
    header: "Fulfilled",
    align: "right",
    render: (l) => (
      <span className="font-mono text-smoke">{l.qtyFulfilled}</span>
    ),
  },
  {
    key: "available",
    header: "Avail.",
    align: "right",
    render: (l) => (
      <span className="font-mono text-smoke">
        {l.available === null ? "—" : l.available}
      </span>
    ),
  },
  {
    key: "lineTotal",
    header: "Total",
    align: "right",
    render: (l) => (
      <span className="font-mono font-bold text-ink">{peso(l.lineTotal)}</span>
    ),
  },
];

function AddressBlock({
  title,
  address,
}: {
  title: string;
  address: OrderAddress;
}) {
  const empty =
    !address.name && !address.line1 && !address.city && !address.phone;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="gap-1 font-mono text-[0.8125rem] text-ink">
        {empty ? (
          <span className="text-smoke">No address on file.</span>
        ) : (
          <>
            {address.name && <span className="font-bold">{address.name}</span>}
            {address.line1 && <span>{address.line1}</span>}
            {address.line2 && <span>{address.line2}</span>}
            <span>
              {[
                address.barangay,
                address.city,
                address.province,
                address.region,
                address.postal,
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
            {address.country && <span>{address.country}</span>}
            {address.phone && (
              <span className="text-smoke">☎ {address.phone}</span>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  const { data, isLoading, isError } = useOrder(orderId);

  const upload = useUploadPaymentProof(orderId);
  const verify = useVerifyPayment(orderId);
  const reject = useRejectPayment(orderId);
  const ship = useShipOrder(orderId);
  const deliver = useDeliverOrder(orderId);
  const cancel = useCancelOrder(orderId);

  const [actionError, setActionError] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  // Ship sheet state.
  const [shipOpen, setShipOpen] = useState(false);
  const [shipWarehouseId, setShipWarehouseId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const warehouses = useWarehouseOptions(shipOpen);

  function reportError(err: unknown, fallback: string) {
    const mapped = unwrapFieldErrors(err);
    setActionError(
      mapped?.formErrors.length
        ? mapped.formErrors
        : mapped
          ? Object.values(mapped.fieldErrors).flat()
          : [fallback],
    );
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError([]);
    try {
      await fn();
    } catch (err) {
      reportError(err, "Action failed. Try again.");
    }
  }

  async function submitUpload() {
    if (!file) {
      setActionError(["Choose a proof image to upload."]);
      return;
    }
    setActionError([]);
    try {
      await upload.mutateAsync({ file, reference: reference.trim() || undefined });
      setFile(null);
      setReference("");
    } catch (err) {
      reportError(err, "Could not upload the proof. Try again.");
    }
  }

  function openShip() {
    if (!data) return;
    setShipWarehouseId(data.shipFromWarehouse?.id ?? "");
    setCarrier("");
    setTracking("");
    setActionError([]);
    setShipOpen(true);
  }

  async function submitShip() {
    setActionError([]);
    try {
      await ship.mutateAsync({
        warehouseId: shipWarehouseId || undefined,
        carrier: carrier.trim() || undefined,
        trackingNumber: tracking.trim() || undefined,
      });
      setShipOpen(false);
    } catch (err) {
      reportError(err, "Could not ship the order. Try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ShoppingCart className="size-6" aria-hidden="true" />}
        title="Order not found"
        description="This order could not be loaded. It may have been removed."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/orders">Back to orders</Link>
          </Button>
        }
      />
    );
  }

  const status = data.status;
  const payment = data.payment;
  const pendingProof =
    payment?.status === "PENDING" && Boolean(payment.proofImageUrl);
  const busy =
    upload.isPending ||
    verify.isPending ||
    reject.isPending ||
    ship.isPending ||
    deliver.isPending ||
    cancel.isPending;

  const canShip = status === "CONFIRMED";
  const canDeliver =
    status === "FULFILLED" || status === "PARTIALLY_FULFILLED";
  const canCancel = status === "PENDING" || status === "CONFIRMED";
  const showPaymentControls = status === "PENDING";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={data.orderNumber}
        description={`${data.channel} · ${
          data.fulfillmentType === "PICKUP"
            ? `Pickup${data.branch ? ` @ ${data.branch.name}` : ""}`
            : "Delivery"
        } · Placed ${formatDate(data.placedAt)}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/orders">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-2 border-line bg-paper px-4 py-3 shadow-press">
        <StatusPill kind="order" value={status} />
        <div className="flex flex-col">
          <span className="font-medium text-ink">{data.customer.name}</span>
          <span className="font-mono text-[0.75rem] text-smoke">
            {data.customer.email}
            {data.customer.phone ? ` · ${data.customer.phone}` : ""}
          </span>
        </div>
        {data.confirmedAt && (
          <span className="font-mono text-[0.75rem] text-smoke">
            Confirmed {formatDate(data.confirmedAt)}
          </span>
        )}
      </div>

      <OrderStepper status={status} />

      {actionError.length > 0 && (
        <div className="border-2 border-soldout bg-soldout/10 px-4 py-3">
          {actionError.map((m, i) => (
            <p key={i} className="font-mono text-[0.8125rem] text-soldout">
              {m}
            </p>
          ))}
        </div>
      )}

      {/* Action bar */}
      {(canShip || canDeliver || canCancel) && (
        <div className="flex flex-wrap items-center gap-2">
          {canShip && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={openShip}
            >
              <Truck className="size-4" aria-hidden="true" />
              Ship order
            </Button>
          )}
          {canDeliver && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => deliver.mutateAsync())}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Mark delivered
            </Button>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => runAction(() => cancel.mutateAsync())}
            >
              Cancel order
            </Button>
          )}
        </div>
      )}

      {/* Line items */}
      <DataTable<OrderLineInfo>
        columns={lineColumns}
        rows={data.lines}
        getRowKey={(l) => l.id}
      />

      {/* Two-column detail grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment + proof */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Payment</CardTitle>
            {payment && (
              <StatusPill kind="order" value={payment.status} />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[0.8125rem] text-ink">
              <span>
                <span className="text-smoke">Amount </span>
                {peso(payment ? payment.amount : data.totals.grandTotal)}
              </span>
              <span>
                <span className="text-smoke">Method </span>
                {payment?.methodName ?? payment?.provider ?? "—"}
              </span>
              {payment?.reference && (
                <span>
                  <span className="text-smoke">Ref </span>
                  {payment.reference}
                </span>
              )}
              {payment?.verifiedAt && (
                <span className="text-smoke">
                  Verified {formatDate(payment.verifiedAt)}
                </span>
              )}
            </div>

            {payment?.proofImageUrl ? (
              <a
                href={assetUrl(payment.proofImageUrl)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block w-fit border-2 border-line shadow-press"
              >
                <img
                  src={assetUrl(payment.proofImageUrl)}
                  alt="Payment proof"
                  className="max-h-48 object-contain"
                />
              </a>
            ) : (
              <span className="font-mono text-[0.75rem] text-smoke">
                No proof of payment uploaded yet.
              </span>
            )}

            {payment?.status === "FAILED" && (
              <span className="font-mono text-[0.75rem] text-soldout">
                Previous proof was rejected — upload a new one.
              </span>
            )}

            {showPaymentControls && (
              <div className="mt-2 flex flex-col gap-3 border-t-2 border-line pt-4">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Proof image (JPG/PNG/WEBP)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="font-mono text-[0.75rem] text-ink file:mr-3 file:cursor-pointer file:border-2 file:border-line file:bg-paper file:px-3 file:py-1.5 file:font-mono file:text-[0.6875rem] file:font-bold file:uppercase file:text-ink"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Reference / note (optional)</span>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. GCash ref 0123456789"
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy || !file}
                    onClick={submitUpload}
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    {upload.isPending ? "Uploading…" : "Upload proof"}
                  </Button>
                  {pendingProof && (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onClick={() => runAction(() => verify.mutateAsync())}
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Verify payment
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => runAction(() => reject.mutateAsync(undefined))}
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fulfillment / delivery */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Fulfillment</CardTitle>
            {data.fulfillment && (
              <StatusPill kind="fulfillment" value={data.fulfillment.status} />
            )}
          </CardHeader>
          <CardContent className="font-mono text-[0.8125rem] text-ink">
            {data.fulfillment ? (
              <>
                <span>
                  <span className="text-smoke">From </span>
                  {data.fulfillment.warehouse.code} ·{" "}
                  {data.fulfillment.warehouse.name}
                </span>
                {data.fulfillment.carrier && (
                  <span>
                    <span className="text-smoke">Carrier </span>
                    {data.fulfillment.carrier}
                  </span>
                )}
                {data.fulfillment.trackingNumber && (
                  <span>
                    <span className="text-smoke">Tracking </span>
                    {data.fulfillment.trackingNumber}
                  </span>
                )}
                {data.fulfillment.shippedAt && (
                  <span className="text-smoke">
                    Shipped {formatDate(data.fulfillment.shippedAt)}
                  </span>
                )}
                {data.fulfillment.deliveredAt && (
                  <span className="text-smoke">
                    Delivered {formatDate(data.fulfillment.deliveredAt)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-smoke">
                Not yet fulfilled. Ships from{" "}
                {data.shipFromWarehouse
                  ? `${data.shipFromWarehouse.code} · ${data.shipFromWarehouse.name}`
                  : "the default warehouse"}{" "}
                once shipped.
              </span>
            )}
          </CardContent>
        </Card>

        <AddressBlock title="Shipping address" address={data.shipAddress} />

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="gap-1.5 font-mono text-[0.8125rem]">
            <div className="flex justify-between text-smoke">
              <span>Subtotal</span>
              <span>{peso(data.totals.subtotal)}</span>
            </div>
            {data.totals.discountTotal > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Discount</span>
                <span>−{peso(data.totals.discountTotal)}</span>
              </div>
            )}
            {data.totals.taxTotal > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Tax</span>
                <span>{peso(data.totals.taxTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-smoke">
              <span>Shipping</span>
              <span>{peso(data.totals.shippingTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-line pt-2 text-base font-bold text-ink">
              <span>Grand total</span>
              <span>{peso(data.totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ship sheet — warehouse override + carrier info */}
      <Sheet open={shipOpen} onOpenChange={setShipOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Ship order</SheetTitle>
            <SheetDescription>
              Deducts stock from the ship-from warehouse and marks the order
              fulfilled. Override the warehouse if the default is short on stock.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-6">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Ship from warehouse</span>
              <select
                value={shipWarehouseId}
                onChange={(e) => setShipWarehouseId(e.target.value)}
                className={inputClass}
              >
                {warehouses.data?.length ? (
                  warehouses.data.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                      {w.isDefaultWeb ? " (default web)" : ""}
                    </option>
                  ))
                ) : (
                  <option value="">
                    {data.shipFromWarehouse
                      ? `${data.shipFromWarehouse.code} · ${data.shipFromWarehouse.name}`
                      : "Default warehouse"}
                  </option>
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Carrier (optional)</span>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. LBC, J&T"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Tracking number (optional)</span>
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={ship.isPending}
              onClick={submitShip}
            >
              {ship.isPending ? "Shipping…" : "Confirm shipment"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
