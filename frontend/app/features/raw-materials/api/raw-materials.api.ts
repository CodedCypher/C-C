/**
 * circuit.rocks — raw-materials feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints (base /raw-materials): GET / (list), GET /:id (detail),
 * POST / (create), PATCH /:id (update), DELETE /:id. Warehouse options for the
 * initial-stock builder come from GET /warehouses.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import { z } from "zod";
import {
  createRawMaterialResultSchema,
  deleteRawMaterialResultSchema,
  publishRawMaterialResultSchema,
  rawMaterialDetailSchema,
  rawMaterialRowSchema,
  warehouseOptionSchema,
  type CreateRawMaterialInput,
  type CreateRawMaterialResult,
  type DeleteRawMaterialResult,
  type PublishRawMaterialInput,
  type PublishRawMaterialResult,
  type RawMaterialDetail,
  type RawMaterialRow,
  type UpdateRawMaterialInput,
  type WarehouseOption,
} from "../types/raw-materials.types";

const rawMaterialsPageSchema = paginatedSchema(rawMaterialRowSchema);
const warehouseOptionsSchema = z.array(warehouseOptionSchema);

export interface RawMaterialsParams {
  filter?: string;
  q?: string;
  page?: number;
  take?: number;
}

/** GET /raw-materials — paginated, filterable material list. */
export async function getRawMaterials(
  params: RawMaterialsParams,
): Promise<Paginated<RawMaterialRow>> {
  const res = await api.get("/raw-materials", { params });
  return rawMaterialsPageSchema.parse(res.data);
}

/** GET /raw-materials/:id — full material detail (per-warehouse + movements). */
export async function getRawMaterial(id: string): Promise<RawMaterialDetail> {
  const res = await api.get(`/raw-materials/${id}`);
  return rawMaterialDetailSchema.parse(res.data);
}

/** POST /raw-materials — create a material; returns the created summary. */
export async function createRawMaterial(
  body: CreateRawMaterialInput,
): Promise<CreateRawMaterialResult> {
  const res = await api.post("/raw-materials", body);
  return createRawMaterialResultSchema.parse(res.data);
}

/** PATCH /raw-materials/:id — partial update; returns the full detail. */
export async function updateRawMaterial(
  id: string,
  body: UpdateRawMaterialInput,
): Promise<RawMaterialDetail> {
  const res = await api.patch(`/raw-materials/${id}`, body);
  return rawMaterialDetailSchema.parse(res.data);
}

/** DELETE /raw-materials/:id — remove a material; returns { id }. */
export async function deleteRawMaterial(
  id: string,
): Promise<DeleteRawMaterialResult> {
  const res = await api.delete(`/raw-materials/${id}`);
  return deleteRawMaterialResultSchema.parse(res.data);
}

/** POST /raw-materials/:id/publish — turn a material into a sellable product. */
export async function publishRawMaterial(
  id: string,
  body: PublishRawMaterialInput,
): Promise<PublishRawMaterialResult> {
  const res = await api.post(`/raw-materials/${id}/publish`, body);
  return publishRawMaterialResultSchema.parse(res.data);
}

/**
 * GET /warehouses — parse just the option subset the initial-stock builder
 * needs. (The full warehouses feature lives elsewhere; we don't import it.)
 */
export async function getWarehouseOptions(): Promise<WarehouseOption[]> {
  const res = await api.get("/warehouses");
  return warehouseOptionsSchema.parse(res.data);
}
