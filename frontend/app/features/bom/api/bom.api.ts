/**
 * circuit.rocks — bom feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints live under the `/bom` domain root, plus the minimal
 * `GET /inventory/options` (line picker) and `GET /warehouses` (feasibility
 * select) subsets this feature needs.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import { z } from "zod";
import {
  bomCostSchema,
  bomDetailSchema,
  bomExplosionSchema,
  bomFeasibilitySchema,
  bomStockItemOptionSchema,
  bomVariantRowSchema,
  bomVersionSchema,
  bomWarehouseOptionSchema,
  bomWhereUsedSchema,
  bomWriteResultSchema,
  type BomCost,
  type BomDetail,
  type BomExplosion,
  type BomFeasibility,
  type BomStockItemOption,
  type BomVariantRow,
  type BomVersion,
  type BomWarehouseOption,
  type BomWhereUsed,
  type BomWriteResult,
  type CreateBomInput,
  type UpdateBomInput,
} from "../types/bom.types";

const bomVariantsPageSchema = paginatedSchema(bomVariantRowSchema);
const bomVersionsSchema = z.array(bomVersionSchema);
const bomWhereUsedListSchema = z.array(bomWhereUsedSchema);
const bomStockItemOptionsSchema = z.array(bomStockItemOptionSchema);
const bomWarehouseOptionsSchema = z.array(bomWarehouseOptionSchema);

export interface BomVariantsParams {
  q?: string;
  page?: number;
  take?: number;
}

/** GET /bom/variants — paginated index of variants + their BOM status. */
export async function getBomVariants(
  params: BomVariantsParams,
): Promise<Paginated<BomVariantRow>> {
  const res = await api.get("/bom/variants", { params });
  return bomVariantsPageSchema.parse(res.data);
}

/** GET /bom?variantId= — the version list for a variant (version desc). */
export async function getBomVersions(
  variantId: string,
): Promise<BomVersion[]> {
  const res = await api.get("/bom", { params: { variantId } });
  return bomVersionsSchema.parse(res.data);
}

/** GET /bom/:id — full BOM detail with lines. */
export async function getBom(id: string): Promise<BomDetail> {
  const res = await api.get(`/bom/${id}`);
  return bomDetailSchema.parse(res.data);
}

/**
 * GET /bom/:id/explode?qty= — the recursive explosion tree + flattened leaves.
 * May 409 on a cyclic BOM — callers surface that via `unwrapFieldErrors`.
 */
export async function explodeBom(
  id: string,
  qty: number,
): Promise<BomExplosion> {
  const res = await api.get(`/bom/${id}/explode`, { params: { qty } });
  return bomExplosionSchema.parse(res.data);
}

/** GET /bom/:id/cost?qty= — unit + extended cost rollup with per-line costs. */
export async function getBomCost(id: string, qty: number): Promise<BomCost> {
  const res = await api.get(`/bom/${id}/cost`, { params: { qty } });
  return bomCostSchema.parse(res.data);
}

/** GET /bom/where-used?stockItemId= — every BOM that consumes this item. */
export async function getBomWhereUsed(
  stockItemId: string,
): Promise<BomWhereUsed[]> {
  const res = await api.get("/bom/where-used", { params: { stockItemId } });
  return bomWhereUsedListSchema.parse(res.data);
}

/**
 * GET /bom/:id/feasibility?qty=&warehouseId= — can this many be built from the
 * named warehouse's stock, with a per-input shortfall breakdown.
 */
export async function getBomFeasibility(
  id: string,
  qty: number,
  warehouseId: string,
): Promise<BomFeasibility> {
  const res = await api.get(`/bom/${id}/feasibility`, {
    params: { qty, warehouseId },
  });
  return bomFeasibilitySchema.parse(res.data);
}

/** POST /bom — create a new (active) version for a variant. */
export async function createBom(
  body: CreateBomInput,
): Promise<BomWriteResult> {
  const res = await api.post("/bom", body);
  return bomWriteResultSchema.parse(res.data);
}

/**
 * PATCH /bom/:id — edit a BOM's notes and/or lines.
 * 409 if locked by a build order — callers surface that via `unwrapFieldErrors`.
 */
export async function updateBom(
  id: string,
  body: UpdateBomInput,
): Promise<BomWriteResult> {
  const res = await api.patch(`/bom/${id}`, body);
  return bomWriteResultSchema.parse(res.data);
}

/** POST /bom/:id/activate — make this version the variant's active BOM. */
export async function activateBom(id: string): Promise<BomWriteResult> {
  const res = await api.post(`/bom/${id}/activate`);
  return bomWriteResultSchema.parse(res.data);
}

/**
 * GET /inventory/options — searchable stock-item picker for BOM lines. BOM
 * lines accept variants AND materials, so we never narrow by `kind`. `q`
 * filters by name/SKU.
 */
export async function getBomStockItemOptions(params: {
  q?: string;
}): Promise<BomStockItemOption[]> {
  const res = await api.get("/inventory/options", { params });
  return bomStockItemOptionsSchema.parse(res.data);
}

/**
 * GET /warehouses — parse just the option subset the feasibility <select>
 * needs. (The full warehouses feature lives elsewhere; we don't import it.)
 */
export async function getBomWarehouseOptions(): Promise<BomWarehouseOption[]> {
  const res = await api.get("/warehouses");
  return bomWarehouseOptionsSchema.parse(res.data);
}
