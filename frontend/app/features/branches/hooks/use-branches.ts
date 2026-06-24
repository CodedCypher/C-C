/**
 * circuit.rocks — branches feature: query + mutation hooks.
 *
 * CANONICAL PATTERN:
 *   - a `branchKeys` query-key factory so hooks + mutations agree on keys
 *   - `useQuery` wrappers for reads (list / detail / derived inventory / WH
 *     options)
 *   - `useMutation` wrappers for writes; on success they invalidate the keys the
 *     write affects and DO NOT swallow errors (pages map them via
 *     `unwrapFieldErrors`)
 *
 * The inventory sub-list keys on `{ id, params }` so changing filters/page/search
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
  getBranches,
  getBranch,
  getBranchInventory,
  getBranchWarehouseOptions,
  createBranch,
  updateBranch,
  setBranchWarehouses,
  type BranchInventoryParams,
  type CreateBranchBody,
  type UpdateBranchBody,
  type BranchWarehouseLinkInput,
} from "../api/branches.api";

export const branchKeys = {
  all: ["branches"] as const,
  list: () => ["branches", "list"] as const,
  detail: (id: string) => ["branches", "detail", id] as const,
  inventory: (id: string, params: BranchInventoryParams) =>
    ["branches", "inventory", id, params] as const,
  warehouseOptions: ["branches", "warehouse-options"] as const,
};

/* ----------------------------- Queries ----------------------------- */

export function useBranches() {
  return useQuery({
    queryKey: branchKeys.list(),
    queryFn: () => getBranches(),
  });
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: branchKeys.detail(id),
    queryFn: () => getBranch(id),
    enabled: Boolean(id),
  });
}

export function useBranchInventory(id: string, params: BranchInventoryParams) {
  return useQuery({
    queryKey: branchKeys.inventory(id, params),
    queryFn: () => getBranchInventory(id, params),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

/** The warehouse option list for the link manager (GET /warehouses subset). */
export function useBranchWarehouseOptions() {
  return useQuery({
    queryKey: branchKeys.warehouseOptions,
    queryFn: () => getBranchWarehouseOptions(),
  });
}

/* ---------------------------- Mutations ---------------------------- */

export function useCreateBranch() {
  return useMutation({
    mutationFn: (body: CreateBranchBody) => createBranch(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}

export function useUpdateBranch(id: string) {
  return useMutation({
    mutationFn: (body: UpdateBranchBody) => updateBranch(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}

export function useSetBranchWarehouses(id: string) {
  return useMutation({
    mutationFn: (links: BranchWarehouseLinkInput[]) =>
      setBranchWarehouses(id, links),
    onSuccess: () => {
      // Links change both the detail and the derived inventory rollup.
      queryClient.invalidateQueries({ queryKey: branchKeys.all });
    },
  });
}
