/**
 * circuit.rocks — raw-materials feature: warehouse-options query hook.
 *
 * Loads the warehouse option subset for the create form's initial-stock
 * builder. Options rarely change, so the default cache behaviour is fine.
 */

import { useQuery } from "@tanstack/react-query";

import { getWarehouseOptions } from "../api/raw-materials.api";
import { rawMaterialKeys } from "./use-raw-materials";

export function useWarehouseOptions() {
  return useQuery({
    queryKey: rawMaterialKeys.warehouseOptions,
    queryFn: getWarehouseOptions,
  });
}
