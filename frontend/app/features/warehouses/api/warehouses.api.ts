/**
 * circuit.rocks — warehouses feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * GET /warehouses returns a PLAIN ARRAY (not paginated), so we parse with
 * `z.array(warehouseRowSchema)`. The per-warehouse stock sub-list DOES use the
 * paginated envelope. Writes (create / update / delete) propagate backend 400/
 * 409 errors un-caught so pages can map them via `unwrapFieldErrors`.
 */

import { z } from "zod";

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import {
  warehouseRowSchema,
  warehouseDetailSchema,
  warehouseStockRowSchema,
  warehouseCreatedSchema,
  warehouseIdResultSchema,
  type WarehouseRow,
  type WarehouseDetail,
  type WarehouseStockRow,
  type WarehouseCreated,
  type WarehouseIdResult,
} from "../types/warehouses.types";

const warehousesListSchema = z.array(warehouseRowSchema);
const warehouseStockPageSchema = paginatedSchema(warehouseStockRowSchema);

/** GET /warehouses — full warehouse list (plain array, not paginated). */
export async function getWarehouses(): Promise<WarehouseRow[]> {
  const res = await api.get("/warehouses");
  return warehousesListSchema.parse(res.data);
}

/** GET /warehouses/:id — header + address + stock summary. */
export async function getWarehouse(id: string): Promise<WarehouseDetail> {
  const res = await api.get(`/warehouses/${id}`);
  return warehouseDetailSchema.parse(res.data);
}

export interface WarehouseStockParams {
  q?: string;
  filter?: string;
  page?: number;
  take?: number;
}

/** GET /warehouses/:id/stock — paginated, filterable per-warehouse stock. */
export async function getWarehouseStock(
  id: string,
  params: WarehouseStockParams,
): Promise<Paginated<WarehouseStockRow>> {
  const res = await api.get(`/warehouses/${id}/stock`, { params });
  return warehouseStockPageSchema.parse(res.data);
}

/**
 * Body for POST /warehouses. Codes / names / addresses are plain strings;
 * optional address fields may be omitted. `isDefaultWeb` flags the warehouse
 * that fulfils online orders.
 */
export interface CreateWarehouseBody {
  name: string;
  code: string;
  type: string;
  isDefaultWeb?: boolean;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

/** POST /warehouses — create a warehouse. Errors propagate (400/409). */
export async function createWarehouse(
  body: CreateWarehouseBody,
): Promise<WarehouseCreated> {
  const res = await api.post("/warehouses", body);
  return warehouseCreatedSchema.parse(res.data);
}

/**
 * Body for PATCH /warehouses/:id — partial update (any subset, incl `isActive`).
 */
export interface UpdateWarehouseBody {
  name?: string;
  code?: string;
  type?: string;
  isDefaultWeb?: boolean;
  isActive?: boolean;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
}

/** PATCH /warehouses/:id — partial update. Errors propagate (400/409). */
export async function updateWarehouse(
  id: string,
  body: UpdateWarehouseBody,
): Promise<WarehouseIdResult> {
  const res = await api.patch(`/warehouses/${id}`, body);
  return warehouseIdResultSchema.parse(res.data);
}

/**
 * DELETE /warehouses/:id — remove a warehouse. The backend returns a structured
 * 409 when the warehouse still holds stock (onHand > 0 anywhere); callers surface
 * it via `unwrapFieldErrors`, so we don't catch here.
 */
export async function deleteWarehouse(id: string): Promise<WarehouseIdResult> {
  const res = await api.delete(`/warehouses/${id}`);
  return warehouseIdResultSchema.parse(res.data);
}
