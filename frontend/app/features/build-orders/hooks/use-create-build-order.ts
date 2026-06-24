/**
 * circuit.rocks — build-orders feature: create-build-order mutation hook.
 *
 * CANONICAL PATTERN for a mutation hook:
 *   - wrap the api call in `useMutation({ mutationFn })`
 *   - on success, invalidate the queries this write affects (here: every
 *     build-order list, so the new order shows up)
 *   - DO NOT swallow errors here — let them propagate so the page can map
 *     `unwrapFieldErrors(error)` (400/409) back onto form fields
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { createBuildOrder } from "../api/build-orders.api";
import { buildOrderKeys } from "./use-build-orders";

export function useCreateBuildOrder() {
  return useMutation({
    mutationFn: createBuildOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildOrderKeys.all });
    },
  });
}
