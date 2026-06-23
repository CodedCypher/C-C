/**
 * circuit.rocks — products feature: form-options query hook.
 *
 * Loads the brand/category/warehouse options for the create-product form. The
 * create-brand / create-category mutations invalidate `productKeys.formOptions`
 * so newly created options appear here too.
 */

import { useQuery } from "@tanstack/react-query";

import { getProductFormOptions } from "../api/products.api";
import { productKeys } from "./use-products";

export function useProductFormOptions() {
  return useQuery({
    queryKey: productKeys.formOptions,
    queryFn: getProductFormOptions,
  });
}
