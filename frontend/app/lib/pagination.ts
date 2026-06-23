/**
 * circuit.rocks — paginated list contract.
 *
 * Every list endpoint returns `{ rows, total, page, take }`. `paginatedSchema`
 * wraps a row schema into that envelope so the api layer can `.parse()` a list
 * response in one line, and `Paginated<T>` is the inferred type for consumers.
 */

import { z } from "zod";

/** Wrap a row schema into the standard `{ rows, total, page, take }` envelope. */
export function paginatedSchema<T extends z.ZodTypeAny>(rowSchema: T) {
  return z.object({
    rows: z.array(rowSchema),
    total: z.number(),
    page: z.number(),
    take: z.number(),
  });
}

/** The shape produced by `paginatedSchema(rowSchema)` for a given row type. */
export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  take: number;
}
