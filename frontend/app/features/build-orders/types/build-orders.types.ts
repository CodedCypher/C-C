/**
 * circuit.rocks — build-orders feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the manufacturing
 * build-orders (work-orders) domain. They:
 *   1. validate API responses in `api/build-orders.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend contracts under `/build-orders` (list rows, the detail
 *      shape, lifecycle action results) plus the minimal `GET /bom/variants`
 *      (output-variant picker) and `GET /warehouses` (build warehouse) subsets
 *      the create form needs.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form pickers
 *   - a `createXxxSchema` mirroring the backend DTO for the create form
 *   - quantities are STRINGS in payloads (Prisma Decimal — no float drift)
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enums
 * ------------------------------------------------------------------ */

/** Lifecycle status of a build order (BuildOrder.status). */
export const buildOrderStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
export type BuildOrderStatus = z.infer<typeof buildOrderStatusSchema>;

/** 4dp quantity (build quantities — Prisma Decimal(14,4)). */
export const QTY_4 = /^\d{1,10}(\.\d{1,4})?$/;

/* ------------------------------------------------------------------ *
 * List row (GET /build-orders)
 * ------------------------------------------------------------------ */

export const buildOrderRowSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  sku: z.string(),
  productTitle: z.string(),
  status: buildOrderStatusSchema,
  qtyPlanned: z.number(),
  qtyProduced: z.number(),
  warehouseCode: z.string(),
  bomVersion: z.number(),
  createdAt: z.string(),
});
export type BuildOrderRow = z.infer<typeof buildOrderRowSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /build-orders/:id)
 * ------------------------------------------------------------------ */

/** The output variant the build produces. */
export const buildOrderVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string(),
});
export type BuildOrderVariant = z.infer<typeof buildOrderVariantSchema>;

/** The bill-of-materials version driving the build. */
export const buildOrderBomSchema = z.object({
  id: z.string(),
  version: z.number(),
});
export type BuildOrderBom = z.infer<typeof buildOrderBomSchema>;

/** The warehouse the build consumes from / outputs to. */
export const buildOrderWarehouseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type BuildOrderWarehouse = z.infer<typeof buildOrderWarehouseSchema>;

/** A BOM component line: what the build needs per unit + for the plan. */
export const buildOrderComponentSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  perUnit: z.number(),
  requiredForPlanned: z.number(),
  scrapPct: z.number().nullable(),
});
export type BuildOrderComponent = z.infer<typeof buildOrderComponentSchema>;

/** A consumption posted when the build started (material drawn down). */
export const buildOrderConsumptionSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  warehouseCode: z.string(),
});
export type BuildOrderConsumption = z.infer<typeof buildOrderConsumptionSchema>;

/** An output produced when the build completed (finished goods + lot). */
export const buildOrderOutputSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  quantity: z.number(),
  computedUnitCost: z.number(),
  lotCode: z.string(),
});
export type BuildOrderOutput = z.infer<typeof buildOrderOutputSchema>;

export const buildOrderDetailSchema = z.object({
  id: z.string(),
  variant: buildOrderVariantSchema,
  bom: buildOrderBomSchema,
  warehouse: buildOrderWarehouseSchema,
  status: buildOrderStatusSchema,
  qtyPlanned: z.number(),
  qtyProduced: z.number(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  components: z.array(buildOrderComponentSchema),
  consumptions: z.array(buildOrderConsumptionSchema),
  outputs: z.array(buildOrderOutputSchema),
});
export type BuildOrderDetail = z.infer<typeof buildOrderDetailSchema>;

/* ------------------------------------------------------------------ *
 * Create payload (POST /build-orders)
 * ------------------------------------------------------------------ */

export const createBuildOrderSchema = z.object({
  variantId: z.string().min(1, "Pick an output variant."),
  bomId: z.string().optional(),
  warehouseId: z.string().min(1, "Pick a build warehouse."),
  qtyPlanned: z.string().regex(QTY_4, {
    message: "Quantity must be a number with up to 4 decimals.",
  }),
  notes: z.string().optional(),
});
export type CreateBuildOrderInput = z.infer<typeof createBuildOrderSchema>;

/* ------------------------------------------------------------------ *
 * Complete payload (POST /build-orders/:id/complete)
 * ------------------------------------------------------------------ */

export const completeBuildOrderSchema = z.object({
  qtyProduced: z.string().regex(QTY_4, {
    message: "Quantity must be a number with up to 4 decimals.",
  }),
});
export type CompleteBuildOrderInput = z.infer<typeof completeBuildOrderSchema>;

/* ------------------------------------------------------------------ *
 * Lifecycle action results
 * ------------------------------------------------------------------ */

/** POST /build-orders → { id }. */
export const createBuildOrderResultSchema = z.object({
  id: z.string(),
});
export type CreateBuildOrderResult = z.infer<
  typeof createBuildOrderResultSchema
>;

/** plan/start/cancel → { id, status }. */
export const buildOrderActionResultSchema = z.object({
  id: z.string(),
  status: buildOrderStatusSchema,
});
export type BuildOrderActionResult = z.infer<
  typeof buildOrderActionResultSchema
>;

/** complete → { id, status, computedUnitCost }. */
export const completeBuildOrderResultSchema = z.object({
  id: z.string(),
  status: buildOrderStatusSchema,
  computedUnitCost: z.number(),
});
export type CompleteBuildOrderResult = z.infer<
  typeof completeBuildOrderResultSchema
>;

/* ------------------------------------------------------------------ *
 * Output-variant picker subset (GET /bom/variants)
 *
 * The full BOM feature is built elsewhere; the create form only needs the
 * variant-option subset to pick an output variant that has an active BOM, so
 * we declare a minimal schema here rather than importing that feature.
 * ------------------------------------------------------------------ */

export const bomVariantOptionSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  title: z.string(),
  sourcingType: z.string(),
  hasActiveBom: z.boolean(),
  activeBomId: z.string().nullable(),
  versionCount: z.number(),
});
export type BomVariantOption = z.infer<typeof bomVariantOptionSchema>;

/* ------------------------------------------------------------------ *
 * Build-warehouse option subset (GET /warehouses)
 *
 * The full warehouses feature lives elsewhere; we declare the minimal option
 * subset the build-warehouse <select> needs rather than importing it.
 * ------------------------------------------------------------------ */

export const buildWarehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type BuildWarehouseOption = z.infer<typeof buildWarehouseOptionSchema>;
