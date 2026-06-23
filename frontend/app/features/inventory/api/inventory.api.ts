/**
 * circuit.rocks — inventory feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints are the NEW domain roots (the backend `admin` god-module was split
 * into per-domain modules): GET /inventory, GET /warehouses.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import { z } from "zod";
import {
  inventoryRowSchema,
  inventoryDetailSchema,
  adjustResultSchema,
  warehouseOptionSchema,
  type InventoryRow,
  type InventoryDetail,
  type AdjustResult,
  type WarehouseOption,
} from "../types/inventory.types";

const inventoryPageSchema = paginatedSchema(inventoryRowSchema);
const warehouseOptionsSchema = z.array(warehouseOptionSchema);

export interface InventoryParams {
  filter?: string;
  q?: string;
  page?: number;
  take?: number;
  warehouseId?: string;
}

/** GET /inventory — paginated, filterable stock list. */
export async function getInventory(
  params: InventoryParams,
): Promise<Paginated<InventoryRow>> {
  const res = await api.get("/inventory", { params });
  return inventoryPageSchema.parse(res.data);
}

/** GET /inventory/:stockItemId — full detail (rollup + warehouses + ledger). */
export async function getInventoryItem(
  stockItemId: string,
): Promise<InventoryDetail> {
  const res = await api.get(`/inventory/${stockItemId}`);
  return inventoryDetailSchema.parse(res.data);
}

/** Body for POST /inventory/:stockItemId/adjust. Quantities are STRINGS. */
export interface AdjustStockBody {
  warehouseId: string;
  /** Signed delta, e.g. "-5" or "12.5". */
  qtyDelta: string;
  note?: string;
}

/**
 * POST /inventory/:stockItemId/adjust — post a manual stock adjustment.
 * The backend returns a structured 409 when an adjustment would drive on-hand
 * negative; callers surface it via `unwrapFieldErrors`, so we don't catch here.
 */
export async function adjustStock(
  stockItemId: string,
  body: AdjustStockBody,
): Promise<AdjustResult> {
  const res = await api.post(`/inventory/${stockItemId}/adjust`, body);
  return adjustResultSchema.parse(res.data);
}

/**
 * Body for the reorder PATCH endpoints. Quantities are STRINGS (or null to
 * clear). All three override fields are set together — send every value to
 * retain it (omitting a field is treated as "no change" by the form, but the
 * backend persists the trio as a unit).
 */
export interface SetReorderBody {
  reorderPoint?: string | null;
  reorderQty?: string | null;
  safetyStock?: string | null;
}

/** PATCH /inventory/:stockItemId/reorder — set the item-level reorder policy. */
export async function setReorder(
  stockItemId: string,
  body: SetReorderBody,
): Promise<{ id: string }> {
  const res = await api.patch(`/inventory/${stockItemId}/reorder`, body);
  return z.object({ id: z.string() }).parse(res.data);
}

/**
 * PATCH /inventory/:stockItemId/warehouses/:warehouseId/reorder — set the
 * per-warehouse reorder override (same SetReorder shape).
 */
export async function setWarehouseReorder(
  stockItemId: string,
  warehouseId: string,
  body: SetReorderBody,
): Promise<{ stockItemId: string; warehouseId: string }> {
  const res = await api.patch(
    `/inventory/${stockItemId}/warehouses/${warehouseId}/reorder`,
    body,
  );
  return z
    .object({ stockItemId: z.string(), warehouseId: z.string() })
    .parse(res.data);
}

/**
 * GET /warehouses — parse just the option subset the warehouse <select> needs.
 * (The full warehouses feature lives elsewhere; we don't import it.)
 */
export async function getWarehouseOptions(): Promise<WarehouseOption[]> {
  const res = await api.get("/warehouses");
  return warehouseOptionsSchema.parse(res.data);
}
