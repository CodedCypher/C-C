/**
 * circuit.rocks — transfers feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the stock-transfers domain.
 * They:
 *   1. validate API responses in `api/transfers.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend contracts under `/stock-transfers` (list rows, the
 *      detail shape, the lifecycle action results) plus the minimal
 *      `GET /warehouses` and `GET /inventory/options` subsets the create form
 *      and the line builder need.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form selects
 *   - a `createXxxSchema` mirroring the backend DTO for the create form
 *   - quantities are STRINGS end-to-end (Prisma Decimal — no float drift)
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enums
 * ------------------------------------------------------------------ */

/** Lifecycle status of a stock transfer (StockTransfer.status). */
export const transferStatusSchema = z.enum([
  "DRAFT",
  "REQUESTED",
  "IN_TRANSIT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);
export type TransferStatus = z.infer<typeof transferStatusSchema>;

/** 4dp quantity (StockTransferLine quantities — Prisma Decimal(14,4)). */
export const QTY_4 = /^\d{1,10}(\.\d{1,4})?$/;

/* ------------------------------------------------------------------ *
 * Warehouse endpoints (code/name) shared across rows + detail
 * ------------------------------------------------------------------ */

/** The warehouse subset embedded in list rows + detail (code + name). */
export const transferWarehouseSchema = z.object({
  code: z.string(),
  name: z.string(),
});
export type TransferWarehouse = z.infer<typeof transferWarehouseSchema>;

/** The warehouse subset embedded in detail (adds id). */
export const transferWarehouseRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type TransferWarehouseRef = z.infer<typeof transferWarehouseRefSchema>;

/* ------------------------------------------------------------------ *
 * List row (GET /stock-transfers)
 * ------------------------------------------------------------------ */

export const transferRowSchema = z.object({
  id: z.string(),
  transferNumber: z.string(),
  sourceWarehouse: transferWarehouseSchema,
  destWarehouse: transferWarehouseSchema,
  status: transferStatusSchema,
  lineCount: z.number(),
  createdAt: z.string(),
  shippedAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
});
export type TransferRow = z.infer<typeof transferRowSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /stock-transfers/:id)
 * ------------------------------------------------------------------ */

export const transferLineSchema = z.object({
  id: z.string(),
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  quantity: z.number(),
  qtyShipped: z.number(),
  qtyReceived: z.number(),
});
export type TransferLine = z.infer<typeof transferLineSchema>;

export const transferDetailSchema = z.object({
  id: z.string(),
  transferNumber: z.string(),
  status: transferStatusSchema,
  notes: z.string().nullable(),
  sourceWarehouse: transferWarehouseRefSchema,
  destWarehouse: transferWarehouseRefSchema,
  shippedAt: z.string().nullable(),
  receivedAt: z.string().nullable(),
  createdAt: z.string(),
  lines: z.array(transferLineSchema),
});
export type TransferDetail = z.infer<typeof transferDetailSchema>;

/* ------------------------------------------------------------------ *
 * Create / update payloads (POST + PATCH /stock-transfers)
 * ------------------------------------------------------------------ */

/** A single line in the create/update payload — quantity is a STRING. */
export const transferLineInputSchema = z.object({
  stockItemId: z.string().min(1, "Pick a stock item."),
  quantity: z.string().regex(QTY_4, {
    message: "Quantity must be a number with up to 4 decimals.",
  }),
});
export type TransferLineInput = z.infer<typeof transferLineInputSchema>;

export const createTransferSchema = z
  .object({
    sourceWarehouseId: z.string().min(1, "Pick a source warehouse."),
    destWarehouseId: z.string().min(1, "Pick a destination warehouse."),
    notes: z.string().optional(),
    lines: z.array(transferLineInputSchema).min(1, "Add at least one line."),
  })
  .refine((v) => v.sourceWarehouseId !== v.destWarehouseId, {
    message: "Destination must differ from source.",
    path: ["destWarehouseId"],
  });
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

/** PATCH (DRAFT only) — notes and/or full line replacement. */
export const updateTransferSchema = z.object({
  notes: z.string().optional(),
  lines: z.array(transferLineInputSchema).min(1).optional(),
});
export type UpdateTransferInput = z.infer<typeof updateTransferSchema>;

/* ------------------------------------------------------------------ *
 * Receive payload (POST /stock-transfers/:id/receive)
 * ------------------------------------------------------------------ */

export const receiveLineInputSchema = z.object({
  lineId: z.string().min(1),
  qtyReceived: z.string().regex(QTY_4, {
    message: "Quantity must be a number with up to 4 decimals.",
  }),
});
export type ReceiveLineInput = z.infer<typeof receiveLineInputSchema>;

export const receiveTransferSchema = z.object({
  lines: z.array(receiveLineInputSchema).min(1),
});
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;

/* ------------------------------------------------------------------ *
 * Lifecycle action results
 * ------------------------------------------------------------------ */

/** POST /stock-transfers → { id, transferNumber }. */
export const createTransferResultSchema = z.object({
  id: z.string(),
  transferNumber: z.string(),
});
export type CreateTransferResult = z.infer<typeof createTransferResultSchema>;

/** PATCH /stock-transfers/:id → { id, transferNumber }. */
export const updateTransferResultSchema = createTransferResultSchema;
export type UpdateTransferResult = CreateTransferResult;

/** request/ship/receive/cancel → { id, status }. */
export const transferActionResultSchema = z.object({
  id: z.string(),
  status: transferStatusSchema,
});
export type TransferActionResult = z.infer<typeof transferActionResultSchema>;

/* ------------------------------------------------------------------ *
 * Warehouse option subset (GET /warehouses)
 *
 * The full warehouses feature is built by another agent; transfers only needs
 * the option subset for its source/dest <select>s, so we declare a minimal
 * schema here rather than importing that feature.
 * ------------------------------------------------------------------ */

export const transferWarehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type TransferWarehouseOption = z.infer<
  typeof transferWarehouseOptionSchema
>;

/* ------------------------------------------------------------------ *
 * Stock-item option subset (GET /inventory/options) — line picker
 * ------------------------------------------------------------------ */

export const stockItemOptionKindSchema = z.enum(["VARIANT", "MATERIAL"]);
export type StockItemOptionKind = z.infer<typeof stockItemOptionKindSchema>;

export const stockItemOptionSchema = z.object({
  stockItemId: z.string(),
  kind: stockItemOptionKindSchema,
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  standardCost: z.number().nullable(),
});
export type StockItemOption = z.infer<typeof stockItemOptionSchema>;
