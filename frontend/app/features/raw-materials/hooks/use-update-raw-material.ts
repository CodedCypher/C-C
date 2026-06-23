/**
 * circuit.rocks — raw-materials feature: update-material mutation hook.
 *
 * Mutation hook (see use-create-raw-material): on success invalidate every
 * material list AND this material's detail key (the PATCH returns the fresh
 * detail, so the open detail Sheet repaints). Errors propagate so the edit
 * form can map `unwrapFieldErrors(error)` onto its fields.
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { updateRawMaterial } from "../api/raw-materials.api";
import type { UpdateRawMaterialInput } from "../types/raw-materials.types";
import { rawMaterialKeys } from "./use-raw-materials";

export function useUpdateRawMaterial() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRawMaterialInput }) =>
      updateRawMaterial(id, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: rawMaterialKeys.all });
      queryClient.invalidateQueries({
        queryKey: rawMaterialKeys.detail(variables.id),
      });
    },
  });
}
