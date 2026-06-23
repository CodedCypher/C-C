/**
 * circuit.rocks — products feature: inline create-brand mutation hook.
 *
 * On success, invalidates the form-options query so the new brand appears in the
 * brand <select>. The page also receives the parsed brand via the mutation's
 * returned data (to optimistically select it).
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { createBrand } from "../api/products.api";
import { productKeys } from "./use-products";

export function useCreateBrand() {
  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.formOptions });
    },
  });
}
