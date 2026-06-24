/**
 * circuit.rocks — build-orders feature: warehouse-options query hook.
 *
 * Loads the warehouse option subset for the create form's build-warehouse
 * <select>. Options rarely change, so the default cache behaviour is fine.
 */

import { useQuery } from "@tanstack/react-query";

import { getBuildWarehouseOptions } from "../api/build-orders.api";
import { buildOrderKeys } from "./use-build-orders";

export function useBuildWarehouseOptions() {
  return useQuery({
    queryKey: buildOrderKeys.warehouseOptions,
    queryFn: getBuildWarehouseOptions,
  });
}
