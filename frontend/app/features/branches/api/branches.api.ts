/**
 * circuit.rocks — branches feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * GET /branches returns a PLAIN ARRAY (not paginated), so we parse with
 * `z.array(branchRowSchema)`. The derived inventory sub-list DOES use the
 * paginated envelope. The link manager needs the warehouse option list, so we
 * fetch GET /warehouses and parse the minimal option subset here (rather than
 * importing the warehouses feature). Writes propagate backend 400/409 un-caught.
 */

import { z } from "zod";

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import {
  branchRowSchema,
  branchDetailSchema,
  branchInventoryRowSchema,
  branchCreatedSchema,
  branchIdResultSchema,
  type BranchRow,
  type BranchDetail,
  type BranchInventoryRow,
  type BranchCreated,
  type BranchIdResult,
} from "../types/branches.types";

const branchesListSchema = z.array(branchRowSchema);
const branchInventoryPageSchema = paginatedSchema(branchInventoryRowSchema);

/* ------------------------------------------------------------------ *
 * Warehouse option subset (GET /warehouses)
 *
 * The link manager needs id/code/name/type to build the picker. We declare a
 * minimal schema here rather than importing the warehouses feature.
 * ------------------------------------------------------------------ */

export const branchWarehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
});
export type BranchWarehouseOption = z.infer<typeof branchWarehouseOptionSchema>;

const branchWarehouseOptionsSchema = z.array(branchWarehouseOptionSchema);

/** GET /warehouses — parse just the option subset the link manager needs. */
export async function getBranchWarehouseOptions(): Promise<
  BranchWarehouseOption[]
> {
  const res = await api.get("/warehouses");
  return branchWarehouseOptionsSchema.parse(res.data);
}

/* ------------------------------------------------------------------ *
 * Branches
 * ------------------------------------------------------------------ */

/** GET /branches — full branch list (plain array, not paginated). */
export async function getBranches(): Promise<BranchRow[]> {
  const res = await api.get("/branches");
  return branchesListSchema.parse(res.data);
}

/** GET /branches/:id — header + address + linked warehouses. */
export async function getBranch(id: string): Promise<BranchDetail> {
  const res = await api.get(`/branches/${id}`);
  return branchDetailSchema.parse(res.data);
}

export interface BranchInventoryParams {
  q?: string;
  filter?: string;
  page?: number;
  take?: number;
}

/** GET /branches/:id/inventory — paginated, filterable derived rollup. */
export async function getBranchInventory(
  id: string,
  params: BranchInventoryParams,
): Promise<Paginated<BranchInventoryRow>> {
  const res = await api.get(`/branches/${id}/inventory`, { params });
  return branchInventoryPageSchema.parse(res.data);
}

/**
 * Body for POST /branches. Codes / names / addresses / email are plain strings;
 * optional fields may be omitted.
 */
export interface CreateBranchBody {
  name: string;
  code: string;
  email?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

/** POST /branches — create a branch. Errors propagate (400/409). */
export async function createBranch(
  body: CreateBranchBody,
): Promise<BranchCreated> {
  const res = await api.post("/branches", body);
  return branchCreatedSchema.parse(res.data);
}

/** Body for PATCH /branches/:id — partial update (any subset, incl `isActive`). */
export interface UpdateBranchBody {
  name?: string;
  code?: string;
  isActive?: boolean;
  email?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
}

/** PATCH /branches/:id — partial update. Errors propagate (400/409). */
export async function updateBranch(
  id: string,
  body: UpdateBranchBody,
): Promise<BranchIdResult> {
  const res = await api.patch(`/branches/${id}`, body);
  return branchIdResultSchema.parse(res.data);
}

/** One desired branch↔warehouse link in the PUT body. */
export interface BranchWarehouseLinkInput {
  warehouseId: string;
  priority?: number;
  isDefault?: boolean;
}

/**
 * PUT /branches/:id/warehouses — replace the full link set for a branch.
 * Returns the refreshed branch detail (same shape as GET /branches/:id). Errors
 * propagate (400/409 — e.g. multiple defaults).
 */
export async function setBranchWarehouses(
  id: string,
  links: BranchWarehouseLinkInput[],
): Promise<BranchDetail> {
  const res = await api.put(`/branches/${id}/warehouses`, { links });
  return branchDetailSchema.parse(res.data);
}
