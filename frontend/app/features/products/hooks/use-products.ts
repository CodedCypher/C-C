/**
 * circuit.rocks — products feature: list query hook.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep a `productKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`; the params object is part of the key, so
 *     changing filters/page automatically refetches and caches per-combination
 *   - `placeholderData` keeps the previous page visible during pagination
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getProducts, type ProductsParams } from "../api/products.api";

export const productKeys = {
  all: ["products"] as const,
  list: (params: ProductsParams) => ["products", "list", params] as const,
  formOptions: ["products", "form-options"] as const,
};

export function useProducts(params: ProductsParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => getProducts(params),
    placeholderData: keepPreviousData,
  });
}
