/**
 * circuit.rocks — build-orders feature: list query hook + query-key factory.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep a `buildOrderKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing status/page automatically refetches and caches per-combination
 *   - `placeholderData` keeps the previous page visible during pagination
 *
 * The factory is the SINGLE source of keys for the whole feature — the detail
 * hook and every mutation invalidate against it.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getBuildOrders, type BuildOrdersParams } from "../api/build-orders.api";

export const buildOrderKeys = {
  all: ["build-orders"] as const,
  list: (params: BuildOrdersParams) =>
    ["build-orders", "list", params] as const,
  detail: (id: string) => ["build-orders", "detail", id] as const,
  warehouseOptions: ["build-orders", "warehouse-options"] as const,
  bomVariantOptions: (q: string) =>
    ["build-orders", "bom-variant-options", q] as const,
};

export function useBuildOrders(params: BuildOrdersParams) {
  return useQuery({
    queryKey: buildOrderKeys.list(params),
    queryFn: () => getBuildOrders(params),
    placeholderData: keepPreviousData,
  });
}
