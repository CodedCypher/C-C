/**
 * circuit.rocks — orders feature: list query hook.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep an `orderKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing filters/page automatically refetches and caches per-combination
 *   - `placeholderData` keeps the previous page visible during pagination
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getOrders, type OrdersParams } from "../api/orders.api";

export const orderKeys = {
  all: ["orders"] as const,
  list: (params: OrdersParams) => ["orders", "list", params] as const,
};

export function useOrders(params: OrdersParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => getOrders(params),
    placeholderData: keepPreviousData,
  });
}
