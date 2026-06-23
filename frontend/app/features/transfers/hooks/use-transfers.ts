/**
 * circuit.rocks — transfers feature: list query hook + query-key factory.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep a `transferKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing filters/page automatically refetches and caches per-combination
 *   - `placeholderData` keeps the previous page visible during pagination
 *
 * The factory is the SINGLE source of keys for the whole feature — the detail
 * hook and every mutation invalidate against it.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getTransfers, type TransfersParams } from "../api/transfers.api";

export const transferKeys = {
  all: ["transfers"] as const,
  list: (params: TransfersParams) => ["transfers", "list", params] as const,
  detail: (id: string) => ["transfers", "detail", id] as const,
  warehouseOptions: ["transfers", "warehouse-options"] as const,
  stockItemOptions: (q: string) =>
    ["transfers", "stock-item-options", q] as const,
};

export function useTransfers(params: TransfersParams) {
  return useQuery({
    queryKey: transferKeys.list(params),
    queryFn: () => getTransfers(params),
    placeholderData: keepPreviousData,
  });
}
