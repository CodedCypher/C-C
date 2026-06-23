/**
 * circuit.rocks — inventory feature: warehouse-options query hook.
 *
 * Loads the warehouse option subset for the inventory warehouse <select>.
 * Options rarely change, so the default cache behaviour is fine.
 */

import { useQuery } from "@tanstack/react-query";

import { getWarehouseOptions } from "../api/inventory.api";
import { inventoryKeys } from "./use-inventory";

export function useWarehouseOptions() {
  return useQuery({
    queryKey: inventoryKeys.warehouseOptions,
    queryFn: getWarehouseOptions,
  });
}
