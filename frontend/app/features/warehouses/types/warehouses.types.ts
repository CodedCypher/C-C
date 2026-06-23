/**
 * circuit.rocks — warehouses feature: zod schemas + inferred types.
 *
 * Single source of truth for the warehouses domain. Mirrors the backend row
 * shape returned by GET /warehouses (see backend/src/warehouses/
 * warehouses.service.ts → WarehouseRow). The endpoint returns a PLAIN ARRAY
 * (NOT the `{ rows, total, page, take }` paginated envelope), so the api layer
 * parses with `z.array(warehouseRowSchema)`.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * List row (GET /warehouses)
 * ------------------------------------------------------------------ */

export const warehouseRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type WarehouseRow = z.infer<typeof warehouseRowSchema>;
