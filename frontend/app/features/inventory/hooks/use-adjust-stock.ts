/**
 * circuit.rocks — inventory feature: adjust-stock mutation hook.
 *
 * CANONICAL PATTERN for a mutation hook:
 *   - wrap the api call in `useMutation({ mutationFn })`
 *   - on success, invalidate the queries this write affects: every inventory
 *     list (rollups change) AND this item's detail query (warehouses + ledger)
 *   - DO NOT swallow errors here — let them propagate so the page can map
 *     `unwrapFieldErrors(error)` (the structured 409 for a negative on-hand)
 *     back onto the form
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { adjustStock, type AdjustStockBody } from "../api/inventory.api";
import { inventoryKeys } from "./use-inventory";

export function useAdjustStock(stockItemId: string) {
  return useMutation({
    mutationFn: (body: AdjustStockBody) => adjustStock(stockItemId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      queryClient.invalidateQueries({
        queryKey: inventoryKeys.item(stockItemId),
      });
    },
  });
}
