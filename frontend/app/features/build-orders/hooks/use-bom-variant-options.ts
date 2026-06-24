/**
 * circuit.rocks — build-orders feature: bom-variant-options query hook (picker).
 *
 * Backs the search-as-you-type output-variant picker in the create form. The
 * search term is part of the key so each query caches per-term; `enabled` gates
 * the request until the picker is open. `placeholderData` keeps the previous
 * matches visible while the next term loads.
 *
 * Only variants where `hasActiveBom` is true can be built — the picker UI
 * surfaces (but disables) the rest so users understand why a variant is not
 * selectable.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getBomVariantOptions } from "../api/build-orders.api";
import { buildOrderKeys } from "./use-build-orders";

export function useBomVariantOptions(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: buildOrderKeys.bomVariantOptions(term),
    queryFn: () => getBomVariantOptions({ q: term || undefined }),
    enabled,
    placeholderData: keepPreviousData,
  });
}
