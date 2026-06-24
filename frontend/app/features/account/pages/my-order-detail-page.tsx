/**
 * circuit.rocks — account feature: read-only order detail
 * (route /account/orders/$orderId).
 *
 * The customer's view of a single order: order number + status, the shared
 * OrderStepper (reused from the admin orders feature), a line-items table, a
 * totals card, the ship-to address, the payment record (status + method +
 * reference + proof image), and the fulfillment/tracking card. STRICTLY
 * read-only — there are no actions; the admin console drives the order through
 * its lifecycle.
 */

import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ShoppingBag } from "lucide-react";

import {
  DataTable,
  EmptyState,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { OrderStepper } from "~/features/orders";
import { assetUrl } from "~/lib/axios";
import { formatDate, peso2 } from "~/lib/format";
import { useMyOrder } from "../hooks/use-account";
import type {
  MyOrderAddress,
  MyOrderLine,
} from "../types/account.types";

const lineColumns: Column<MyOrderLine>[] = [
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
    render: (l) => (
      <span className="font-mono text-smoke">{peso2(l.unitPrice)}</span>
    ),
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (l) => <span className="font-mono text-ink">{l.quantity}</span>,
  },
  {
    key: "lineTotal",
    header: "Total",
    align: "right",
    render: (l) => (
      <span className="font-mono font-bold text-ink">{peso2(l.lineTotal)}</span>
    ),
  },
];

function AddressCard({ address }: { address: MyOrderAddress }) {
  const empty =
    !address.name && !address.line1 && !address.city && !address.phone;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ship to</CardTitle>
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

export function MyOrderDetailPage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  const { data, isLoading, isError } = useMyOrder(orderId);

  if (isLoading) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-6" aria-hidden="true" />}
        title="Order not found"
        description="This order could not be loaded. It may not be yours, or it may have been removed."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/account/orders">Back to orders</Link>
          </Button>
        }
      />
    );
  }

  const payment = data.payment;
  const fulfillment = data.fulfillment;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-sans text-[1.5rem] font-bold tracking-[-0.02em] text-ink">
            {data.orderNumber}
          </h2>
          <p className="font-mono text-[0.8125rem] text-smoke">
            {data.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"} · Placed{" "}
            {formatDate(data.placedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill kind="order" value={data.status} />
          <Button asChild variant="ghost" size="sm">
            <Link to="/account/orders">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <OrderStepper status={data.status} />

      {/* Line items */}
      <DataTable<MyOrderLine>
        columns={lineColumns}
        rows={data.lines}
        getRowKey={(l) => l.id}
      />

      {/* Detail grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="gap-1.5 font-mono text-[0.8125rem]">
            <div className="flex justify-between text-smoke">
              <span>Subtotal</span>
              <span>{peso2(data.totals.subtotal)}</span>
            </div>
            {data.totals.discountTotal > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Discount</span>
                <span>−{peso2(data.totals.discountTotal)}</span>
              </div>
            )}
            {data.totals.taxTotal > 0 && (
              <div className="flex justify-between text-smoke">
                <span>Tax</span>
                <span>{peso2(data.totals.taxTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-smoke">
              <span>Shipping</span>
              <span>{peso2(data.totals.shippingTotal)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-line pt-2 text-base font-bold text-ink">
              <span>Grand total</span>
              <span>{peso2(data.totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <AddressCard address={data.shipAddress} />

        {/* Payment */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Payment</CardTitle>
            {payment && <StatusPill kind="order" value={payment.status} />}
          </CardHeader>
          <CardContent>
            {payment ? (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[0.8125rem] text-ink">
                  <span>
                    <span className="text-smoke">Amount </span>
                    {peso2(payment.amount)}
                  </span>
                  <span>
                    <span className="text-smoke">Method </span>
                    {payment.methodName ?? "—"}
                  </span>
                  {payment.reference && (
                    <span>
                      <span className="text-smoke">Ref </span>
                      {payment.reference}
                    </span>
                  )}
                </div>
                {payment.proofImageUrl ? (
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
                    No proof of payment on file.
                  </span>
                )}
              </>
            ) : (
              <span className="font-mono text-[0.8125rem] text-smoke">
                No payment recorded yet.
              </span>
            )}
          </CardContent>
        </Card>

        {/* Fulfillment / tracking */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Fulfillment</CardTitle>
            {fulfillment && (
              <StatusPill kind="fulfillment" value={fulfillment.status} />
            )}
          </CardHeader>
          <CardContent className="font-mono text-[0.8125rem] text-ink">
            {fulfillment ? (
              <>
                {fulfillment.carrier && (
                  <span>
                    <span className="text-smoke">Carrier </span>
                    {fulfillment.carrier}
                  </span>
                )}
                {fulfillment.trackingNumber && (
                  <span>
                    <span className="text-smoke">Tracking </span>
                    {fulfillment.trackingNumber}
                  </span>
                )}
                {fulfillment.shippedAt && (
                  <span className="text-smoke">
                    Shipped {formatDate(fulfillment.shippedAt)}
                  </span>
                )}
                {fulfillment.deliveredAt && (
                  <span className="text-smoke">
                    Delivered {formatDate(fulfillment.deliveredAt)}
                  </span>
                )}
                {!fulfillment.carrier &&
                  !fulfillment.trackingNumber &&
                  !fulfillment.shippedAt && (
                    <span className="text-smoke">
                      Awaiting shipment details.
                    </span>
                  )}
              </>
            ) : (
              <span className="text-smoke">Not yet fulfilled.</span>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
