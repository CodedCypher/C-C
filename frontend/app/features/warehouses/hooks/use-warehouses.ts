/**
 * circuit.rocks — warehouses feature: query + mutation hooks.
 *
 * CANONICAL PATTERN:
 *   - a `warehouseKeys` query-key factory so hooks + mutations agree on keys
 *   - `useQuery` wrappers for reads (list / detail / stock sub-list)
 *   - `useMutation` wrappers for writes; on success they invalidate the keys the
 *     write affects and DO NOT swallow errors (pages map them via
 *     `unwrapFieldErrors`)
 *
 * The list takes no params (the endpoint is unfiltered), so its key is static.
 * The stock sub-list keys on `{ id, params }` so changing filters/page/search
 * refetches + caches per combination; `placeholderData` keeps the previous page
 * visible during pagination.
 */

import {
  keepPreviousData,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  getWarehouses,
  getWarehouse,
  getWarehouseStock,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  type WarehouseStockParams,
  type CreateWarehouseBody,
  type UpdateWarehouseBody,
} from "../api/warehouses.api";

export const warehouseKeys = {
  all: ["warehouses"] as const,
  list: () => ["warehouses", "list"] as const,
  detail: (id: string) => ["warehouses", "detail", id] as const,
  stock: (id: string, params: WarehouseStockParams) =>
    ["warehouses", "stock", id, params] as const,
};

/* ----------------------------- Queries ----------------------------- */

export function useWarehouses() {
  return useQuery({
    queryKey: warehouseKeys.list(),
    queryFn: () => getWarehouses(),
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: warehouseKeys.detail(id),
    queryFn: () => getWarehouse(id),
    enabled: Boolean(id),
  });
}

export function useWarehouseStock(id: string, params: WarehouseStockParams) {
  return useQuery({
    queryKey: warehouseKeys.stock(id, params),
    queryFn: () => getWarehouseStock(id, params),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

/* ---------------------------- Mutations ---------------------------- */

export function useCreateWarehouse() {
  return useMutation({
    mutationFn: (body: CreateWarehouseBody) => createWarehouse(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });
}

export function useUpdateWarehouse(id: string) {
  return useMutation({
    mutationFn: (body: UpdateWarehouseBody) => updateWarehouse(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });
}

export function useDeleteWarehouse(id: string) {
  return useMutation({
    mutationFn: () => deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });
}
