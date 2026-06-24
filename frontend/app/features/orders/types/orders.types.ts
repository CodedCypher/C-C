/**
 * circuit.rocks — orders feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the orders domain. They:
 *   1. validate API responses in `api/orders.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend — the `GET /orders` row + `GET /orders/:id` detail
 *      shapes (`backend/src/orders/orders.service.ts`) and the `OrderStatus`
 *      Prisma enum (`backend/prisma/schema.prisma`), kept in sync by hand.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, enum schema for the status filter
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enum (Prisma OrderStatus)
 * ------------------------------------------------------------------ */

export const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/* ------------------------------------------------------------------ *
 * List row (GET /orders)
 * ------------------------------------------------------------------ */

export const orderRowSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customer: z.string(),
  email: z.string(),
  status: orderStatusSchema,
  grandTotal: z.number(),
  lineCount: z.number(),
  placedAt: z.string().nullable(),
});
export type OrderRow = z.infer<typeof orderRowSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /orders/:id)
 * ------------------------------------------------------------------ */

export const orderAddressSchema = z.object({
  name: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  barangay: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  region: z.string().nullable(),
  postal: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
});
export type OrderAddress = z.infer<typeof orderAddressSchema>;

export const orderLineInfoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  qtyFulfilled: z.number(),
  available: z.number().nullable(),
});
export type OrderLineInfo = z.infer<typeof orderLineInfoSchema>;

export const warehouseRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type WarehouseRef = z.infer<typeof warehouseRefSchema>;

export const paymentInfoSchema = z.object({
  id: z.string(),
  provider: z.string(),
  methodName: z.string().nullable(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
  proofImageUrl: z.string().nullable(),
  reference: z.string().nullable(),
  capturedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type PaymentInfo = z.infer<typeof paymentInfoSchema>;

export const fulfillmentInfoSchema = z.object({
  id: z.string(),
  status: z.string(),
  warehouse: warehouseRefSchema,
  carrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
});
export type FulfillmentInfo = z.infer<typeof fulfillmentInfoSchema>;

export const orderDetailSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: orderStatusSchema,
  channel: z.string(),
  fulfillmentType: z.string(),
  email: z.string(),
  currency: z.string(),
  notes: z.string().nullable(),
  placedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  customer: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
  }),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
  shipAddress: orderAddressSchema,
  billAddress: orderAddressSchema,
  totals: z.object({
    subtotal: z.number(),
    discountTotal: z.number(),
    taxTotal: z.number(),
    shippingTotal: z.number(),
    grandTotal: z.number(),
  }),
  lines: z.array(orderLineInfoSchema),
  payment: paymentInfoSchema.nullable(),
  fulfillment: fulfillmentInfoSchema.nullable(),
  shipFromWarehouse: warehouseRefSchema.nullable(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

/* ------------------------------------------------------------------ *
 * Lifecycle action result (verify/reject/ship/deliver/cancel → { id, status })
 * ------------------------------------------------------------------ */

export const orderActionResultSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
});
export type OrderActionResult = z.infer<typeof orderActionResultSchema>;

/** POST /orders/:id/ship payload — optional warehouse override + carrier info. */
export const shipOrderSchema = z.object({
  warehouseId: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
});
export type ShipOrderInput = z.infer<typeof shipOrderSchema>;

/* ------------------------------------------------------------------ *
 * Warehouse option subset (GET /warehouses) — ship-from override <select>
 * ------------------------------------------------------------------ */

export const warehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type WarehouseOption = z.infer<typeof warehouseOptionSchema>;
