/**
 * circuit.rocks — orders feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the orders domain. They:
 *   1. validate API responses in `api/orders.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend — the `GET /orders` row shape
 *      (`backend/src/orders/orders.service.ts`) and the `OrderStatus` Prisma
 *      enum (`backend/prisma/schema.prisma`), kept in sync by hand.
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
  orderNumber: z.string(),
  customer: z.string(),
  email: z.string(),
  status: orderStatusSchema,
  grandTotal: z.number(),
  lineCount: z.number(),
  placedAt: z.string().nullable(),
});
export type OrderRow = z.infer<typeof orderRowSchema>;
