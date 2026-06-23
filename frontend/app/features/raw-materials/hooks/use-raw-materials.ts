/**
 * circuit.rocks — raw-materials feature: list query hook + key factory.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep a `rawMaterialKeys` query-key factory so hooks + mutations agree on
 *     keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing filters/page automatically refetches and caches per combination
 *   - `placeholderData` keeps the previous page visible during pagination
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getRawMaterials, type RawMaterialsParams } from "../api/raw-materials.api";

export const rawMaterialKeys = {
  all: ["raw-materials"] as const,
  list: (params: RawMaterialsParams) =>
    ["raw-materials", "list", params] as const,
  detail: (id: string) => ["raw-materials", "detail", id] as const,
  warehouseOptions: ["raw-materials", "warehouse-options"] as const,
};

export function useRawMaterials(params: RawMaterialsParams) {
  return useQuery({
    queryKey: rawMaterialKeys.list(params),
    queryFn: () => getRawMaterials(params),
    placeholderData: keepPreviousData,
  });
}
