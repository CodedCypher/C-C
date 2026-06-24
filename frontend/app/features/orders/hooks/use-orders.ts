/**
 * circuit.rocks — orders feature: query hooks.
 *
 * CANONICAL PATTERN for list/detail hooks:
 *   - keep an `orderKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing filters/page automatically refetches and caches per-combination
 *   - `placeholderData` keeps the previous page visible during pagination
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getOrder,
  getOrders,
  getWarehouseOptions,
  type OrdersParams,
} from "../api/orders.api";

export const orderKeys = {
  all: ["orders"] as const,
  list: (params: OrdersParams) => ["orders", "list", params] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
};

export function useOrders(params: OrdersParams) {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => getOrders(params),
    placeholderData: keepPreviousData,
  });
}

/** Single order detail (GET /orders/:id) — disabled until `id` is present. */
export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
    enabled: Boolean(id),
  });
}

/** Warehouse options for the ship-from override <select>. */
export function useWarehouseOptions(enabled = true) {
  return useQuery({
    queryKey: ["warehouses", "options"] as const,
    queryFn: getWarehouseOptions,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
