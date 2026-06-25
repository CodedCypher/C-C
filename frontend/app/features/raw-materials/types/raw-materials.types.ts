/**
 * circuit.rocks — raw-materials feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the raw-materials domain.
 * They:
 *   1. validate API responses in `api/raw-materials.api.ts` (every call
 *      `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend contracts EXACTLY (the `GET /raw-materials` row shape,
 *      the `GET /raw-materials/:id` detail shape and the POST/PATCH payloads).
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form selects
 *   - create/update payload schemas mirroring the backend DTO (money as STRING)
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enums
 * ------------------------------------------------------------------ */

/** Derived availability state (computeStockState in the backend). */
export const stockStateSchema = z.enum(["IN_STOCK", "LOW", "OUT"]);
export type StockState = z.infer<typeof stockStateSchema>;

/** UnitOfMeasure enum — mirrors the backend Prisma enum. */
export const unitOfMeasureSchema = z.enum([
  "EACH",
  "METER",
  "CENTIMETER",
  "GRAM",
  "KILOGRAM",
  "LITER",
  "MILLILITER",
  "REEL",
  "ROLL",
  "PACK",
  "SET",
]);
export type UnitOfMeasure = z.infer<typeof unitOfMeasureSchema>;

/** Ordered list of UoM values for form selects (mirrors the enum). */
export const UNITS_OF_MEASURE = unitOfMeasureSchema.options;

/* ------------------------------------------------------------------ *
 * List row (GET /raw-materials)
 * ------------------------------------------------------------------ */

export const rawMaterialRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  standardCost: z.number().nullable(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
  stockState: stockStateSchema,
});
export type RawMaterialRow = z.infer<typeof rawMaterialRowSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /raw-materials/:id)
 * ------------------------------------------------------------------ */

export const rawMaterialWarehouseSchema = z.object({
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
});
export type RawMaterialWarehouse = z.infer<typeof rawMaterialWarehouseSchema>;

export const rawMaterialMovementSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  qtyDelta: z.number(),
  reason: z.string(),
  refType: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type RawMaterialMovement = z.infer<typeof rawMaterialMovementSchema>;

/** Set once a material has been published as a sellable storefront product. */
export const publishedProductSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  slug: z.string(),
  title: z.string(),
});
export type PublishedProduct = z.infer<typeof publishedProductSchema>;

export const rawMaterialDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  defaultUnit: z.string(),
  trackLot: z.boolean(),
  trackSerial: z.boolean(),
  standardCost: z.number().nullable(),
  reorderPoint: z.number().nullable(),
  reorderQty: z.number().nullable(),
  safetyStock: z.number().nullable(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  published: publishedProductSchema.nullable(),
  warehouses: z.array(rawMaterialWarehouseSchema),
  movements: z.array(rawMaterialMovementSchema),
});
export type RawMaterialDetail = z.infer<typeof rawMaterialDetailSchema>;

/* ------------------------------------------------------------------ *
 * Warehouse option subset (GET /warehouses)
 *
 * The full warehouses feature is built elsewhere; raw-materials only needs the
 * option subset for the initial-stock builder, so we declare a minimal schema
 * here rather than importing that feature (mirrors how inventory does it).
 * ------------------------------------------------------------------ */

export const warehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type WarehouseOption = z.infer<typeof warehouseOptionSchema>;

/* ------------------------------------------------------------------ *
 * Mutation results
 * ------------------------------------------------------------------ */

/** POST /raw-materials → created summary. */
export const createRawMaterialResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
});
export type CreateRawMaterialResult = z.infer<
  typeof createRawMaterialResultSchema
>;

/** DELETE /raw-materials/:id → { id }. */
export const deleteRawMaterialResultSchema = z.object({
  id: z.string(),
});
export type DeleteRawMaterialResult = z.infer<
  typeof deleteRawMaterialResultSchema
>;

/** POST /raw-materials/:id/publish → the new sellable product/variant. */
export const publishRawMaterialResultSchema = z.object({
  rawMaterialId: z.string(),
  productId: z.string(),
  variantId: z.string(),
  slug: z.string(),
  title: z.string(),
});
export type PublishRawMaterialResult = z.infer<
  typeof publishRawMaterialResultSchema
>;

/* ------------------------------------------------------------------ *
 * Create / update payloads (POST + PATCH /raw-materials)
 *
 * Quantities/costs are STRINGS end-to-end (Prisma Decimal). These are the
 * shapes the api layer sends; the page serialises its local form state to
 * these (omitting blanks, never sending "").
 * ------------------------------------------------------------------ */

export interface InitialStockInput {
  warehouseId: string;
  onHand: string;
}

export interface CreateRawMaterialInput {
  name: string;
  sku: string;
  description?: string;
  defaultUnit: UnitOfMeasure;
  standardCost?: string;
  reorderPoint?: string;
  reorderQty?: string;
  safetyStock?: string;
  trackLot?: boolean;
  trackSerial?: boolean;
  initialStock?: InitialStockInput[];
}

export interface UpdateRawMaterialInput {
  name?: string;
  description?: string;
  defaultUnit?: UnitOfMeasure;
  standardCost?: string | null;
  reorderPoint?: string;
  reorderQty?: string;
  safetyStock?: string;
  trackLot?: boolean;
  trackSerial?: boolean;
}

export interface PublishRawMaterialInput {
  price: string;
  initialStock?: string;
  sku?: string;
  slug?: string;
  categoryId?: string;
}
