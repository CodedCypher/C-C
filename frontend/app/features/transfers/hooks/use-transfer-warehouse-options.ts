/**
 * circuit.rocks — transfers feature: warehouse-options query hook.
 *
 * Loads the warehouse option subset for the create form's source/dest
 * <select>s. Options rarely change, so the default cache behaviour is fine.
 */

import { useQuery } from "@tanstack/react-query";

import { getTransferWarehouseOptions } from "../api/transfers.api";
import { transferKeys } from "./use-transfers";

export function useTransferWarehouseOptions() {
  return useQuery({
    queryKey: transferKeys.warehouseOptions,
    queryFn: getTransferWarehouseOptions,
  });
}
