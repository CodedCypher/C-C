/**
 * circuit.rocks — products feature: inline create-category mutation hook.
 *
 * On success, invalidates the form-options query so the new category appears in
 * the categories picker. The page selects the returned, parsed category.
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { createCategory } from "../api/products.api";
import { productKeys } from "./use-products";

export function useCreateCategory() {
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.formOptions });
    },
  });
}
