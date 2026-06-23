/**
 * circuit.rocks — warehouses feature: list query hook.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep a `warehouseKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`
 *
 * The list takes no params (the endpoint is unfiltered), so the key is static.
 */

import { useQuery } from "@tanstack/react-query";

import { getWarehouses } from "../api/warehouses.api";

export const warehouseKeys = {
  all: ["warehouses"] as const,
  list: () => ["warehouses", "list"] as const,
};

export function useWarehouses() {
  return useQuery({
    queryKey: warehouseKeys.list(),
    queryFn: () => getWarehouses(),
  });
}
