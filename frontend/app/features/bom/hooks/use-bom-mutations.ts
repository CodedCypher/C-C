/**
 * circuit.rocks — bom feature: write mutations (create / update / activate).
 *
 * CANONICAL PATTERN for a mutation hook:
 *   - wrap the api call in `useMutation({ mutationFn })`
 *   - on success, invalidate the queries this write affects (the whole `bom`
 *     namespace — version list, detail, the variants index status badges)
 *   - DO NOT swallow errors here — let them propagate so the page can map
 *     `unwrapFieldErrors(error)` (400/409: cycle, locked, field errors) back
 *     onto form fields/cells
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { activateBom, createBom, updateBom } from "../api/bom.api";
import { bomKeys } from "./use-bom";
import type { UpdateBomInput } from "../types/bom.types";

/** POST /bom — create a new active version for a variant. */
export function useCreateBom() {
  return useMutation({
    mutationFn: createBom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}

/** PATCH /bom/:id — edit a BOM's notes and/or lines. */
export function useUpdateBom(id: string) {
  return useMutation({
    mutationFn: (body: UpdateBomInput) => updateBom(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}

/** POST /bom/:id/activate — make this version the variant's active BOM. */
export function useActivateBom() {
  return useMutation({
    mutationFn: (id: string) => activateBom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bomKeys.all });
    },
  });
}
