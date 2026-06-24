/**
 * circuit.rocks — account feature: zod schemas + inferred types.
 *
 * The customer-facing "account hub" data contracts (the `me` backend module).
 * These are the SINGLE SOURCE OF TRUTH for the profile, the read-only order
 * history, and a single order's detail; every api call `.parse()`s through
 * them. The order status enum is reused from the admin `orders` feature so the
 * shared `StatusPill` paints customer + admin views identically.
 */

import { z } from "zod";

import { paginatedSchema } from "~/lib/pagination";
import { orderStatusSchema } from "~/features/orders";

/* ------------------------------------------------------------------ *
 * Profile (GET/PATCH /me/profile)
 * ------------------------------------------------------------------ */

export const profileSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  marketingOptIn: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

/** Body for PATCH /me/profile — every editable field, all optional. */
export const profileInputSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  marketingOptIn: z.boolean().optional(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

/* ------------------------------------------------------------------ *
 * My orders (GET /me/orders — read-only history)
 * ------------------------------------------------------------------ */

export const myOrderRowSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: orderStatusSchema,
  grandTotal: z.number(),
  lineCount: z.number(),
  placedAt: z.string().nullable(),
});
export type MyOrderRow = z.infer<typeof myOrderRowSchema>;

export const myOrdersSchema = paginatedSchema(myOrderRowSchema);

/* ------------------------------------------------------------------ *
 * My order detail (GET /me/orders/:id)
 * ------------------------------------------------------------------ */

export const myOrderAddressSchema = z.object({
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
export type MyOrderAddress = z.infer<typeof myOrderAddressSchema>;

export const myOrderLineSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});
export type MyOrderLine = z.infer<typeof myOrderLineSchema>;

export const myOrderTotalsSchema = z.object({
  subtotal: z.number(),
  discountTotal: z.number(),
  taxTotal: z.number(),
  shippingTotal: z.number(),
  grandTotal: z.number(),
});
export type MyOrderTotals = z.infer<typeof myOrderTotalsSchema>;

export const myOrderPaymentSchema = z.object({
  status: z.string(),
  methodName: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  reference: z.string().nullable(),
  proofImageUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type MyOrderPayment = z.infer<typeof myOrderPaymentSchema>;

export const myOrderFulfillmentSchema = z.object({
  status: z.string(),
  carrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
});
export type MyOrderFulfillment = z.infer<typeof myOrderFulfillmentSchema>;

export const myOrderDetailSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: orderStatusSchema,
  fulfillmentType: z.string(),
  currency: z.string(),
  placedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  shipAddress: myOrderAddressSchema,
  totals: myOrderTotalsSchema,
  lines: z.array(myOrderLineSchema),
  payment: myOrderPaymentSchema.nullable(),
  fulfillment: myOrderFulfillmentSchema.nullable(),
});
export type MyOrderDetail = z.infer<typeof myOrderDetailSchema>;
