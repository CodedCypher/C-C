/**
 * circuit.rocks — raw-materials feature: create-material mutation hook.
 *
 * CANONICAL PATTERN for a mutation hook:
 *   - wrap the api call in `useMutation({ mutationFn })`
 *   - on success, invalidate the queries this write affects (here: every
 *     material list, so the new material shows up)
 *   - DO NOT swallow errors here — let them propagate so the page can map
 *     `unwrapFieldErrors(error)` (400/409) back onto form fields
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { createRawMaterial } from "../api/raw-materials.api";
import { rawMaterialKeys } from "./use-raw-materials";

export function useCreateRawMaterial() {
  return useMutation({
    mutationFn: createRawMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rawMaterialKeys.all });
    },
  });
}
