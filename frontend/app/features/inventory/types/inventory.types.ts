/**
 * circuit.rocks — inventory feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the inventory domain. They:
 *   1. validate API responses in `api/inventory.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend contracts — the `GET /inventory` row shape
 *      (`backend/src/inventory/inventory.service.ts`) and the minimal
 *      `GET /warehouses` option subset (`backend/src/warehouses/
 *      warehouses.service.ts`).
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form selects
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enums
 * ------------------------------------------------------------------ */

/** StockItem.kind — a finished variant vs a raw material. */
export const inventoryKindSchema = z.enum(["VARIANT", "MATERIAL"]);
export type InventoryKind = z.infer<typeof inventoryKindSchema>;

/** Derived availability state (computeStockState in the backend). */
export const stockStateSchema = z.enum(["IN_STOCK", "LOW", "OUT"]);
export type StockState = z.infer<typeof stockStateSchema>;

/* ------------------------------------------------------------------ *
 * List row (GET /inventory)
 * ------------------------------------------------------------------ */

export const inventoryRowSchema = z.object({
  /** StockItem id — the key the detail page (`/inventory/:stockItemId`) reads. */
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  kind: inventoryKindSchema,
  uom: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
  stockState: stockStateSchema,
});
export type InventoryRow = z.infer<typeof inventoryRowSchema>;

/* ------------------------------------------------------------------ *
 * Item detail (GET /inventory/:stockItemId)
 *
 * The full picture for one stock item: global rollup buckets + reorder
 * policy, the per-warehouse breakdown, and the movement ledger. Mirrors the
 * `findOne` shape in `backend/src/inventory/inventory.service.ts`.
 * ------------------------------------------------------------------ */

/** Per-warehouse stock levels + that warehouse's reorder-point override. */
export const inventoryWarehouseLevelSchema = z.object({
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
});
export type InventoryWarehouseLevel = z.infer<
  typeof inventoryWarehouseLevelSchema
>;

/** A single posted stock movement (ledger row). `qtyDelta` is signed. */
export const inventoryMovementSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string(),
  qtyDelta: z.number(),
  reason: z.string(),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;

export const inventoryDetailSchema = z.object({
  id: z.string(),
  kind: inventoryKindSchema,
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  standardCost: z.number().nullable(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
  reorderQty: z.number().nullable(),
  safetyStock: z.number().nullable(),
  warehouses: z.array(inventoryWarehouseLevelSchema),
  movements: z.array(inventoryMovementSchema),
});
export type InventoryDetail = z.infer<typeof inventoryDetailSchema>;

/* ------------------------------------------------------------------ *
 * Stock adjustment result (POST /inventory/:stockItemId/adjust)
 *
 * Returns the affected warehouse's new buckets + the recomputed global
 * rollup so the panel can reflect the new on-hand without a refetch.
 * ------------------------------------------------------------------ */

const stockBucketsSchema = z.object({
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
});

export const adjustResultSchema = z.object({
  stockItemId: z.string(),
  warehouse: stockBucketsSchema.extend({ warehouseId: z.string() }),
  rollup: stockBucketsSchema,
});
export type AdjustResult = z.infer<typeof adjustResultSchema>;

/* ------------------------------------------------------------------ *
 * Warehouse option subset (GET /warehouses)
 *
 * The full warehouses feature is built by another agent; inventory only needs
 * the option subset for its warehouse <select>, so we declare a minimal schema
 * here rather than importing that feature.
 * ------------------------------------------------------------------ */

export const warehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type WarehouseOption = z.infer<typeof warehouseOptionSchema>;
