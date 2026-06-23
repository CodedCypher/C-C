/**
 * circuit.rocks — transfers feature: stock-item-options query hook (line picker).
 *
 * Backs the search-as-you-type stock-item picker in the line builder. The
 * search term is part of the key so each query caches per-term; `enabled`
 * gates the request until the user has typed (avoids a spurious empty-query
 * fetch on mount). `placeholderData` keeps the previous matches visible while
 * the next term loads.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getStockItemOptions } from "../api/transfers.api";
import { transferKeys } from "./use-transfers";

export function useStockItemOptions(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: transferKeys.stockItemOptions(term),
    queryFn: () => getStockItemOptions({ q: term || undefined }),
    enabled: enabled && term.length > 0,
    placeholderData: keepPreviousData,
  });
}
