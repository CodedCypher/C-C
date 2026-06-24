/**
 * circuit.rocks — branches feature: zod schemas + inferred types.
 *
 * Single source of truth for the branches domain. Mirrors the backend contracts
 * (backend/src/branches/branches.service.ts):
 *   - GET /branches              → plain array of `branchRowSchema` (city nullable)
 *   - GET /branches/:id          → `branchDetailSchema` (address + linked WHs)
 *   - PUT /branches/:id/warehouses → returns the same detail shape
 *   - GET /branches/:id/inventory  → paginated `branchInventoryRowSchema` (derived
 *     rollup across the branch's linked warehouses, with a per-warehouse breakdown)
 *   - POST / PATCH                 → small `{ id, ... }` result shapes
 *
 * The list endpoint returns a PLAIN ARRAY (NOT the paginated envelope), so the
 * api layer parses it with `z.array(...)`. The inventory sub-list DOES use the
 * paginated envelope.
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
export const branchStockKindSchema = z.enum(["VARIANT", "MATERIAL"]);
export type BranchStockKind = z.infer<typeof branchStockKindSchema>;

/** Derived availability state (computeStockState in the backend). */
export const stockStateSchema = z.enum(["IN_STOCK", "LOW", "OUT"]);
export type StockState = z.infer<typeof stockStateSchema>;

/* ------------------------------------------------------------------ *
 * List row (GET /branches)
 * ------------------------------------------------------------------ */

export const branchRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  city: z.string().nullable(),
});
export type BranchRow = z.infer<typeof branchRowSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /branches/:id and PUT /branches/:id/warehouses)
 *
 * Header + address (nullable strings) + the ordered list of linked warehouses.
 * Each link carries its own `id` (the join-row id), the `warehouseId`, the
 * warehouse `code`/`name`/`type`, a `priority` (lower = preferred) and an
 * `isDefault` flag (one default per branch).
 * ------------------------------------------------------------------ */

export const branchWarehouseLinkSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  priority: z.number(),
  isDefault: z.boolean(),
});
export type BranchWarehouseLink = z.infer<typeof branchWarehouseLinkSchema>;

export const branchDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
  warehouses: z.array(branchWarehouseLinkSchema),
});
export type BranchDetail = z.infer<typeof branchDetailSchema>;

/* ------------------------------------------------------------------ *
 * Derived inventory row (GET /branches/:id/inventory)
 *
 * A rollup across the branch's linked warehouses, plus a per-warehouse
 * breakdown (`byWarehouse`) rendered as small mono chips.
 * ------------------------------------------------------------------ */

export const branchInventoryByWarehouseSchema = z.object({
  warehouseId: z.string(),
  code: z.string(),
  onHand: z.number(),
});
export type BranchInventoryByWarehouse = z.infer<
  typeof branchInventoryByWarehouseSchema
>;

export const branchInventoryRowSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  kind: branchStockKindSchema,
  uom: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  incoming: z.number(),
  reorderPoint: z.number().nullable(),
  stockState: stockStateSchema,
  byWarehouse: z.array(branchInventoryByWarehouseSchema),
});
export type BranchInventoryRow = z.infer<typeof branchInventoryRowSchema>;

/* ------------------------------------------------------------------ *
 * Write result shapes (POST / PATCH)
 * ------------------------------------------------------------------ */

/** POST /branches → the created branch's identity. */
export const branchCreatedSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type BranchCreated = z.infer<typeof branchCreatedSchema>;

/** PATCH /branches/:id → `{ id }`. */
export const branchIdResultSchema = z.object({ id: z.string() });
export type BranchIdResult = z.infer<typeof branchIdResultSchema>;
