/**
 * circuit.rocks — build-orders feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints live under the `/build-orders` domain root, plus the minimal
 * `GET /bom/variants` (output-variant picker) and `GET /warehouses` (build
 * warehouse) subsets the create form needs.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import { z } from "zod";
import {
  bomVariantOptionSchema,
  buildOrderActionResultSchema,
  buildOrderDetailSchema,
  buildOrderRowSchema,
  buildWarehouseOptionSchema,
  completeBuildOrderResultSchema,
  createBuildOrderResultSchema,
  type BomVariantOption,
  type BuildOrderActionResult,
  type BuildOrderDetail,
  type BuildOrderRow,
  type BuildWarehouseOption,
  type CompleteBuildOrderInput,
  type CompleteBuildOrderResult,
  type CreateBuildOrderInput,
  type CreateBuildOrderResult,
} from "../types/build-orders.types";

const buildOrdersPageSchema = paginatedSchema(buildOrderRowSchema);
const bomVariantsPageSchema = paginatedSchema(bomVariantOptionSchema);
const warehouseOptionsSchema = z.array(buildWarehouseOptionSchema);

export interface BuildOrdersParams {
  status?: string;
  page?: number;
  take?: number;
}

/** GET /build-orders — paginated, status-filterable build-order list. */
export async function getBuildOrders(
  params: BuildOrdersParams,
): Promise<Paginated<BuildOrderRow>> {
  const res = await api.get("/build-orders", { params });
  return buildOrdersPageSchema.parse(res.data);
}

/** GET /build-orders/:id — full build-order detail (components/consumptions/outputs). */
export async function getBuildOrder(id: string): Promise<BuildOrderDetail> {
  const res = await api.get(`/build-orders/${id}`);
  return buildOrderDetailSchema.parse(res.data);
}

/** POST /build-orders — create a build order; returns the new id. */
export async function createBuildOrder(
  body: CreateBuildOrderInput,
): Promise<CreateBuildOrderResult> {
  const res = await api.post("/build-orders", body);
  return createBuildOrderResultSchema.parse(res.data);
}

/**
 * POST /build-orders/:id/plan — DRAFT → PLANNED.
 * May 409 if components are unavailable — callers surface that via
 * `unwrapFieldErrors`.
 */
export async function planBuildOrder(
  id: string,
): Promise<BuildOrderActionResult> {
  const res = await api.post(`/build-orders/${id}/plan`);
  return buildOrderActionResultSchema.parse(res.data);
}

/** POST /build-orders/:id/start — → IN_PROGRESS (posts consumptions). */
export async function startBuildOrder(
  id: string,
): Promise<BuildOrderActionResult> {
  const res = await api.post(`/build-orders/${id}/start`);
  return buildOrderActionResultSchema.parse(res.data);
}

/**
 * POST /build-orders/:id/complete — → COMPLETED.
 * Records the produced quantity and returns the computed unit cost. May 400/409
 * on shortfalls — callers surface that via `unwrapFieldErrors`.
 */
export async function completeBuildOrder(
  id: string,
  body: CompleteBuildOrderInput,
): Promise<CompleteBuildOrderResult> {
  const res = await api.post(`/build-orders/${id}/complete`, body);
  return completeBuildOrderResultSchema.parse(res.data);
}

/** POST /build-orders/:id/cancel — → CANCELLED. */
export async function cancelBuildOrder(
  id: string,
): Promise<BuildOrderActionResult> {
  const res = await api.post(`/build-orders/${id}/cancel`);
  return buildOrderActionResultSchema.parse(res.data);
}

/**
 * GET /bom/variants — searchable output-variant picker for the create form.
 * `q` filters by title/SKU. Only variants where `hasActiveBom` is true can be
 * built; the create form gates selection on that.
 */
export async function getBomVariantOptions(params: {
  q?: string;
}): Promise<Paginated<BomVariantOption>> {
  const res = await api.get("/bom/variants", { params });
  return bomVariantsPageSchema.parse(res.data);
}

/**
 * GET /warehouses — parse just the option subset the build-warehouse <select>
 * needs. (The full warehouses feature lives elsewhere; we don't import it.)
 */
export async function getBuildWarehouseOptions(): Promise<
  BuildWarehouseOption[]
> {
  const res = await api.get("/warehouses");
  return warehouseOptionsSchema.parse(res.data);
}
