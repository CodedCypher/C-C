/**
 * circuit.rocks — inventory feature: list query hook.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep an `inventoryKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing filters/page/warehouse automatically refetches and caches per
 *     combination
 *   - `placeholderData` keeps the previous page visible during pagination
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getInventory, type InventoryParams } from "../api/inventory.api";

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (params: InventoryParams) => ["inventory", "list", params] as const,
  item: (stockItemId: string) => ["inventory", "item", stockItemId] as const,
  warehouseOptions: ["inventory", "warehouse-options"] as const,
};

export function useInventory(params: InventoryParams) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => getInventory(params),
    placeholderData: keepPreviousData,
  });
}
