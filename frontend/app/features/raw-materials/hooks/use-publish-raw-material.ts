/**
 * circuit.rocks — raw-materials feature: publish-as-product mutation hook.
 *
 * Turns an internal raw material into a sellable storefront Product + Variant
 * (its own web-stock pool). On success invalidate the material lists AND this
 * material's detail key so the open Sheet repaints with its new "Published"
 * state. Errors propagate so the publish form can map `unwrapFieldErrors(error)`
 * onto its fields.
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { publishRawMaterial } from "../api/raw-materials.api";
import type { PublishRawMaterialInput } from "../types/raw-materials.types";
import { rawMaterialKeys } from "./use-raw-materials";

export function usePublishRawMaterial() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PublishRawMaterialInput }) =>
      publishRawMaterial(id, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: rawMaterialKeys.all });
      queryClient.invalidateQueries({
        queryKey: rawMaterialKeys.detail(variables.id),
      });
    },
  });
}
