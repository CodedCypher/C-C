/**
 * circuit.rocks — branches feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * GET /branches returns a PLAIN ARRAY (not paginated), so we parse with
 * `z.array(branchRowSchema)` rather than `paginatedSchema(...)`.
 */

import { z } from "zod";

import { api } from "~/lib/axios";
import { branchRowSchema, type BranchRow } from "../types/branches.types";

const branchesListSchema = z.array(branchRowSchema);

/** GET /branches — full branch list (plain array, not paginated). */
export async function getBranches(): Promise<BranchRow[]> {
  const res = await api.get("/branches");
  return branchesListSchema.parse(res.data);
}
