/**
 * circuit.rocks — raw-materials feature: delete-material mutation hook.
 *
 * Mutation hook (see use-create-raw-material): on success invalidate every
 * material list so the deleted row disappears. Errors propagate so the detail
 * Sheet can surface a failure inline.
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { deleteRawMaterial } from "../api/raw-materials.api";
import { rawMaterialKeys } from "./use-raw-materials";

export function useDeleteRawMaterial() {
  return useMutation({
    mutationFn: deleteRawMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rawMaterialKeys.all });
    },
  });
}
