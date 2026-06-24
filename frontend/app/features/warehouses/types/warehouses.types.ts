/**
 * circuit.rocks — warehouses feature: zod schemas + inferred types.
 *
 * Single source of truth for the warehouses domain. Mirrors the backend
 * contracts (backend/src/warehouses/warehouses.service.ts):
 *   - GET /warehouses          → plain array of `warehouseRowSchema`
 *   - GET /warehouses/:id      → `warehouseDetailSchema` (address + stockSummary)
 *   - GET /warehouses/:id/stock → paginated `warehouseStockRowSchema`
 *   - POST/PATCH/DELETE        → small `{ id, ... }` result shapes
 *
 * The list endpoint returns a PLAIN ARRAY (NOT the `{ rows, total, page, take }`
 * paginated envelope), so the api layer parses it with `z.array(...)`. The stock
 * sub-list DOES use the paginated envelope.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form selects
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enums
 * ------------------------------------------------------------------ */

/** WarehouseType — the kind of stock location. */
export const warehouseTypeSchema = z.enum([
  "DISTRIBUTION",
  "RETAIL_BACKROOM",
  "RETURNS",
  "GENERAL",
]);
export type WarehouseType = z.infer<typeof warehouseTypeSchema>;

/** The four types as an ordered list for <select> options. */
export const WAREHOUSE_TYPES: WarehouseType[] = [
  "DISTRIBUTION",
  "RETAIL_BACKROOM",
  "RETURNS",
  "GENERAL",
];

/** Human label for a warehouse type. */
export function warehouseTypeLabel(type: string): string {
  switch (type) {
    case "DISTRIBUTION":
      return "Distribution";
    case "RETAIL_BACKROOM":
      return "Retail backroom";
    case "RETURNS":
      return "Returns";
    case "GENERAL":
      return "General";
    default:
      return type;
  }
}

/** StockItem.kind — a finished variant vs a raw material. */
export const warehouseStockKindSchema = z.enum(["VARIANT", "MATERIAL"]);
export type WarehouseStockKind = z.infer<typeof warehouseStockKindSchema>;

/** Derived availability state (computeStockState in the backend). */
export const stockStateSchema = z.enum(["IN_STOCK", "LOW", "OUT"]);
export type StockState = z.infer<typeof stockStateSchema>;

/* ------------------------------------------------------------------ *
 * List row (GET /warehouses)
 * ------------------------------------------------------------------ */

export const warehouseRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type WarehouseRow = z.infer<typeof warehouseRowSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /warehouses/:id)
 *
 * Header + address (all nullable strings) + a small stock summary used to
 * paint the MetricCard row.
 * ------------------------------------------------------------------ */

export const warehouseStockSummarySchema = z.object({
  itemCount: z.number(),
  lowCount: z.number(),
  outCount: z.number(),
});
export type WarehouseStockSummary = z.infer<typeof warehouseStockSummarySchema>;

export const warehouseDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
  stockSummary: warehouseStockSummarySchema,
});
export type WarehouseDetail = z.infer<typeof warehouseDetailSchema>;

/* ------------------------------------------------------------------ *
 * Per-warehouse stock row (GET /warehouses/:id/stock)
 * ------------------------------------------------------------------ */

export const warehouseStockRowSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  kind: warehouseStockKindSchema,
  uom: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
  stockState: stockStateSchema,
});
export type WarehouseStockRow = z.infer<typeof warehouseStockRowSchema>;

/* ------------------------------------------------------------------ *
 * Write result shapes (POST / PATCH / DELETE)
 * ------------------------------------------------------------------ */

/** POST /warehouses → the created warehouse's identity. */
export const warehouseCreatedSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type WarehouseCreated = z.infer<typeof warehouseCreatedSchema>;

/** PATCH /warehouses/:id and DELETE /warehouses/:id → `{ id }`. */
export const warehouseIdResultSchema = z.object({ id: z.string() });
export type WarehouseIdResult = z.infer<typeof warehouseIdResultSchema>;
