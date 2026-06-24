/**
 * circuit.rocks — bom feature: query hooks + query-key factory.
 *
 * CANONICAL PATTERN for a list/detail feature:
 *   - keep a `bomKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap each api call in `useQuery`; params are part of the key, so changing
 *     filters/qty/warehouse automatically refetches and caches per-combination
 *   - `placeholderData` keeps the previous result visible during pagination /
 *     while the next qty/warehouse loads
 *
 * The factory is the SINGLE source of keys for the whole feature — every
 * mutation invalidates against it.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getBom,
  getBomCost,
  getBomFeasibility,
  getBomStockItemOptions,
  getBomVariants,
  getBomVersions,
  getBomWarehouseOptions,
  getBomWhereUsed,
  explodeBom,
  type BomVariantsParams,
} from "../api/bom.api";

export const bomKeys = {
  all: ["bom"] as const,
  variants: (params: BomVariantsParams) =>
    ["bom", "variants", params] as const,
  versions: (variantId: string) => ["bom", "versions", variantId] as const,
  detail: (id: string) => ["bom", "detail", id] as const,
  explode: (id: string, qty: number) => ["bom", "explode", id, qty] as const,
  cost: (id: string, qty: number) => ["bom", "cost", id, qty] as const,
  whereUsed: (stockItemId: string) =>
    ["bom", "where-used", stockItemId] as const,
  feasibility: (id: string, qty: number, warehouseId: string) =>
    ["bom", "feasibility", id, qty, warehouseId] as const,
  stockItemOptions: (q: string) => ["bom", "stock-item-options", q] as const,
  warehouseOptions: ["bom", "warehouse-options"] as const,
};

/** GET /bom/variants — the index list (search + pagination). */
export function useBomVariants(params: BomVariantsParams) {
  return useQuery({
    queryKey: bomKeys.variants(params),
    queryFn: () => getBomVariants(params),
    placeholderData: keepPreviousData,
  });
}

/** GET /bom?variantId= — version list for a variant. */
export function useBomVersions(variantId: string) {
  return useQuery({
    queryKey: bomKeys.versions(variantId),
    queryFn: () => getBomVersions(variantId),
    enabled: variantId.length > 0,
  });
}

/** GET /bom/:id — detail for a single BOM (lines). */
export function useBom(id: string | null) {
  return useQuery({
    queryKey: bomKeys.detail(id ?? ""),
    queryFn: () => getBom(id as string),
    enabled: Boolean(id),
  });
}

/** GET /bom/:id/explode?qty= — recursive explosion tree. */
export function useBomExplosion(id: string | null, qty: number) {
  return useQuery({
    queryKey: bomKeys.explode(id ?? "", qty),
    queryFn: () => explodeBom(id as string, qty),
    enabled: Boolean(id) && qty > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** GET /bom/:id/cost?qty= — cost rollup. */
export function useBomCost(id: string | null, qty: number) {
  return useQuery({
    queryKey: bomKeys.cost(id ?? "", qty),
    queryFn: () => getBomCost(id as string, qty),
    enabled: Boolean(id) && qty > 0,
    placeholderData: keepPreviousData,
  });
}

/** GET /bom/where-used?stockItemId= — every BOM consuming this item. */
export function useBomWhereUsed(stockItemId: string | null) {
  return useQuery({
    queryKey: bomKeys.whereUsed(stockItemId ?? ""),
    queryFn: () => getBomWhereUsed(stockItemId as string),
    enabled: Boolean(stockItemId),
  });
}

/** GET /bom/:id/feasibility?qty=&warehouseId= — build feasibility. */
export function useBomFeasibility(
  id: string | null,
  qty: number,
  warehouseId: string,
) {
  return useQuery({
    queryKey: bomKeys.feasibility(id ?? "", qty, warehouseId),
    queryFn: () => getBomFeasibility(id as string, qty, warehouseId),
    enabled: Boolean(id) && qty > 0 && warehouseId.length > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * GET /inventory/options — search-as-you-type line picker. The term is part of
 * the key (caches per-term); `enabled` gates the request until the user types.
 */
export function useBomStockItemOptions(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: bomKeys.stockItemOptions(term),
    queryFn: () => getBomStockItemOptions({ q: term || undefined }),
    enabled: enabled && term.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** GET /warehouses — feasibility warehouse <select> options. */
export function useBomWarehouseOptions() {
  return useQuery({
    queryKey: bomKeys.warehouseOptions,
    queryFn: getBomWarehouseOptions,
  });
}
