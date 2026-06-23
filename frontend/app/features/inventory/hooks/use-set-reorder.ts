/**
 * circuit.rocks — inventory feature: reorder-policy mutation hooks.
 *
 * Two writes, same SetReorder body shape:
 *   - `useSetReorder`          → PATCH /inventory/:id/reorder (item-level)
 *   - `useSetWarehouseReorder` → PATCH /inventory/:id/warehouses/:wid/reorder
 *
 * Both invalidate every inventory list (the effective reorder point can change
 * the derived stock state) and this item's detail query. Errors propagate so
 * the page can map `unwrapFieldErrors(error)` onto the form.
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  setReorder,
  setWarehouseReorder,
  type SetReorderBody,
} from "../api/inventory.api";
import { inventoryKeys } from "./use-inventory";

function invalidate(stockItemId: string) {
  queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
  queryClient.invalidateQueries({ queryKey: inventoryKeys.item(stockItemId) });
}

/** Item-level reorder policy (reorderPoint / reorderQty / safetyStock). */
export function useSetReorder(stockItemId: string) {
  return useMutation({
    mutationFn: (body: SetReorderBody) => setReorder(stockItemId, body),
    onSuccess: () => invalidate(stockItemId),
  });
}

/** Per-warehouse reorder override. */
export function useSetWarehouseReorder(stockItemId: string) {
  return useMutation({
    mutationFn: ({
      warehouseId,
      body,
    }: {
      warehouseId: string;
      body: SetReorderBody;
    }) => setWarehouseReorder(stockItemId, warehouseId, body),
    onSuccess: () => invalidate(stockItemId),
  });
}
