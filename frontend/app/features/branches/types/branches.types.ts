/**
 * circuit.rocks — branches feature: zod schemas + inferred types.
 *
 * Single source of truth for the branches domain. Mirrors the backend row shape
 * returned by GET /branches (see backend/src/branches/branches.service.ts →
 * BranchRow; note `city` is nullable). The endpoint returns a PLAIN ARRAY (NOT
 * the `{ rows, total, page, take }` paginated envelope), so the api layer parses
 * with `z.array(branchRowSchema)`.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows
 */

import { z } from "zod";

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
