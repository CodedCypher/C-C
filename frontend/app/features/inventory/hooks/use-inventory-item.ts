/**
 * circuit.rocks — inventory feature: item-detail query hook.
 *
 * Loads the full picture for one stock item (rollup buckets + reorder policy,
 * per-warehouse breakdown, and the movement ledger) for the item-detail page.
 *
 * CANONICAL PATTERN for a detail hook:
 *   - key off the resource id via the shared `inventoryKeys.item(id)` factory so
 *     mutations can invalidate exactly this query
 *   - `enabled` guards an empty id (the route param may be momentarily absent)
 */

import { useQuery } from "@tanstack/react-query";

import { getInventoryItem } from "../api/inventory.api";
import { inventoryKeys } from "./use-inventory";

export function useInventoryItem(stockItemId: string) {
  return useQuery({
    queryKey: inventoryKeys.item(stockItemId),
    queryFn: () => getInventoryItem(stockItemId),
    enabled: stockItemId.length > 0,
  });
}
