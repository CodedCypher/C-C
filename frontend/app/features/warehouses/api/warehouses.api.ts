/**
 * circuit.rocks — warehouses feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * GET /warehouses returns a PLAIN ARRAY (not paginated), so we parse with
 * `z.array(warehouseRowSchema)` rather than `paginatedSchema(...)`.
 */

import { z } from "zod";

import { api } from "~/lib/axios";
import {
  warehouseRowSchema,
  type WarehouseRow,
} from "../types/warehouses.types";

const warehousesListSchema = z.array(warehouseRowSchema);

/** GET /warehouses — full warehouse list (plain array, not paginated). */
export async function getWarehouses(): Promise<WarehouseRow[]> {
  const res = await api.get("/warehouses");
  return warehousesListSchema.parse(res.data);
}
