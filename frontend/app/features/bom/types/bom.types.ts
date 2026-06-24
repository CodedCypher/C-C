/**
 * circuit.rocks — bom feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the Bill-of-Materials domain.
 * They:
 *   1. validate API responses in `api/bom.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend contracts under `/bom` (variant index, version list,
 *      detail with lines, explosion tree, cost rollup, where-used, build
 *      feasibility) plus the minimal `GET /inventory/options` (line picker) and
 *      `GET /warehouses` (feasibility select) subsets this feature needs.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form selects
 *   - a `createXxxSchema` mirroring the backend DTO for the create/edit form
 *   - quantities / scrap are STRINGS end-to-end (Prisma Decimal — no float drift)
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored enums
 * ------------------------------------------------------------------ */

/** A BOM line input is either a finished sub-variant or a raw material. */
export const bomInputKindSchema = z.enum(["VARIANT", "MATERIAL"]);
export type BomInputKind = z.infer<typeof bomInputKindSchema>;

/** UnitOfMeasure enum (shared with inventory / transfers). */
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

/** Ordered list for the unit <select>. */
export const UNIT_OPTIONS = unitOfMeasureSchema.options;

/** 4dp quantity (Prisma Decimal(14,4)). */
export const QTY_4 = /^\d{1,10}(\.\d{1,4})?$/;
/**
 * Scrap percentage — a non-negative number with up to 4 decimals. The backend
 * owns the exact bounds (e.g. 0..100); we keep the client check permissive so
 * we never reject a value the API would accept (server errors still surface).
 */
export const SCRAP_4 = /^\d{1,3}(\.\d{1,4})?$/;

/* ------------------------------------------------------------------ *
 * Variant index row (GET /bom/variants)
 * ------------------------------------------------------------------ */

export const bomVariantRowSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  title: z.string(),
  sourcingType: z.string(),
  hasActiveBom: z.boolean(),
  activeBomId: z.string().nullable(),
  versionCount: z.number(),
});
export type BomVariantRow = z.infer<typeof bomVariantRowSchema>;

/* ------------------------------------------------------------------ *
 * Version list (GET /bom?variantId=) — version desc
 * ------------------------------------------------------------------ */

export const bomVersionSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  version: z.number(),
  isActive: z.boolean(),
  lineCount: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type BomVersion = z.infer<typeof bomVersionSchema>;

/* ------------------------------------------------------------------ *
 * Detail (GET /bom/:id)
 * ------------------------------------------------------------------ */

export const bomLineSchema = z.object({
  id: z.string(),
  stockItemId: z.string(),
  inputKind: bomInputKindSchema,
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  quantity: z.number(),
  scrapPct: z.number().nullable(),
  isBuilt: z.boolean(),
});
export type BomLine = z.infer<typeof bomLineSchema>;

export const bomDetailSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  variantSku: z.string(),
  variantTitle: z.string(),
  version: z.number(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  lines: z.array(bomLineSchema),
});
export type BomDetail = z.infer<typeof bomDetailSchema>;

/* ------------------------------------------------------------------ *
 * Explosion tree (GET /bom/:id/explode?qty=) — RECURSIVE node
 * ------------------------------------------------------------------ */

/**
 * A node in the explosion tree. The shape is RECURSIVE (`children` is an array
 * of nodes), so we declare it with `z.lazy` and a hand-written type alias (a
 * `z.infer` of a lazy schema collapses to `any`).
 */
export interface BomExplosionNode {
  stockItemId: string;
  name: string;
  sku: string;
  uom: string;
  kind: BomInputKind;
  quantityPerParent: number;
  extendedQty: number;
  scrapPct: number | null;
  isBuilt: boolean;
  children: BomExplosionNode[];
}

export const bomExplosionNodeSchema: z.ZodType<BomExplosionNode> = z.lazy(() =>
  z.object({
    stockItemId: z.string(),
    name: z.string(),
    sku: z.string(),
    uom: z.string(),
    kind: bomInputKindSchema,
    quantityPerParent: z.number(),
    extendedQty: z.number(),
    scrapPct: z.number().nullable(),
    isBuilt: z.boolean(),
    children: z.array(bomExplosionNodeSchema),
  }),
);

export const bomLeafSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  totalQty: z.number(),
});
export type BomLeaf = z.infer<typeof bomLeafSchema>;

export const bomExplosionSchema = z.object({
  qty: z.number(),
  tree: z.array(bomExplosionNodeSchema),
  leaves: z.array(bomLeafSchema),
  maxDepth: z.number(),
});
export type BomExplosion = z.infer<typeof bomExplosionSchema>;

/* ------------------------------------------------------------------ *
 * Cost rollup (GET /bom/:id/cost?qty=)
 * ------------------------------------------------------------------ */

export const bomCostLineSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  qty: z.number(),
  unitStandardCost: z.number().nullable(),
  lineCost: z.number().nullable(),
  isBuilt: z.boolean(),
});
export type BomCostLine = z.infer<typeof bomCostLineSchema>;

export const bomCostSchema = z.object({
  qty: z.number(),
  unitCost: z.number().nullable(),
  extendedCost: z.number().nullable(),
  lines: z.array(bomCostLineSchema),
  hasMissingCost: z.boolean(),
});
export type BomCost = z.infer<typeof bomCostSchema>;

/* ------------------------------------------------------------------ *
 * Where-used (GET /bom/where-used?stockItemId=)
 * ------------------------------------------------------------------ */

export const bomWhereUsedSchema = z.object({
  bomId: z.string(),
  variantId: z.string(),
  variantSku: z.string(),
  productTitle: z.string(),
  version: z.number(),
  isActive: z.boolean(),
  quantity: z.number(),
  unit: z.string(),
});
export type BomWhereUsed = z.infer<typeof bomWhereUsedSchema>;

/* ------------------------------------------------------------------ *
 * Feasibility (GET /bom/:id/feasibility?qty=&warehouseId=)
 * ------------------------------------------------------------------ */

export const bomShortfallSchema = z.object({
  stockItemId: z.string(),
  name: z.string(),
  sku: z.string(),
  required: z.number(),
  available: z.number(),
  short: z.number(),
});
export type BomShortfall = z.infer<typeof bomShortfallSchema>;

export const bomFeasibilitySchema = z.object({
  qty: z.number(),
  warehouseId: z.string(),
  canBuild: z.boolean(),
  buildableMax: z.number(),
  shortfalls: z.array(bomShortfallSchema),
});
export type BomFeasibility = z.infer<typeof bomFeasibilitySchema>;

/* ------------------------------------------------------------------ *
 * Create / update payloads (POST + PATCH /bom)
 * ------------------------------------------------------------------ */

/** A single line in the create/update payload — quantity + scrap are STRINGS. */
export const bomLineInputSchema = z.object({
  stockItemId: z.string().min(1, "Pick a material or sub-variant."),
  quantity: z.string().regex(QTY_4, {
    message: "Quantity must be a number with up to 4 decimals.",
  }),
  unit: unitOfMeasureSchema,
  scrapPct: z
    .string()
    .regex(SCRAP_4, {
      message: "Scrap % must be a non-negative number (up to 4 decimals).",
    })
    .optional(),
});
export type BomLineInput = z.infer<typeof bomLineInputSchema>;

export const createBomSchema = z.object({
  variantId: z.string().min(1, "A variant is required."),
  notes: z.string().optional(),
  lines: z.array(bomLineInputSchema).min(1, "Add at least one line."),
});
export type CreateBomInput = z.infer<typeof createBomSchema>;

/** PATCH /bom/:id — notes and/or full line replacement. */
export const updateBomSchema = z.object({
  notes: z.string().optional(),
  lines: z.array(bomLineInputSchema).min(1).optional(),
});
export type UpdateBomInput = z.infer<typeof updateBomSchema>;

/* ------------------------------------------------------------------ *
 * Write result (POST + PATCH + activate)
 * ------------------------------------------------------------------ */

export const bomWriteResultSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  version: z.number(),
  isActive: z.boolean(),
});
export type BomWriteResult = z.infer<typeof bomWriteResultSchema>;

/* ------------------------------------------------------------------ *
 * Stock-item option subset (GET /inventory/options) — line picker
 *
 * BOM lines accept BOTH variants (sub-assemblies) AND materials, so the picker
 * does not filter by kind. Minimal schema declared here (self-contained
 * feature — we don't import the inventory/transfers feature).
 * ------------------------------------------------------------------ */

export const bomStockItemOptionSchema = z.object({
  stockItemId: z.string(),
  kind: bomInputKindSchema,
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  standardCost: z.number().nullable(),
});
export type BomStockItemOption = z.infer<typeof bomStockItemOptionSchema>;

/* ------------------------------------------------------------------ *
 * Warehouse option subset (GET /warehouses) — feasibility select
 * ------------------------------------------------------------------ */

export const bomWarehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type BomWarehouseOption = z.infer<typeof bomWarehouseOptionSchema>;
