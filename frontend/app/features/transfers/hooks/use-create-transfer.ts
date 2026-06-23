/**
 * circuit.rocks — transfers feature: create-transfer mutation hook.
 *
 * CANONICAL PATTERN for a mutation hook:
 *   - wrap the api call in `useMutation({ mutationFn })`
 *   - on success, invalidate the queries this write affects (here: every
 *     transfer list, so the new draft shows up)
 *   - DO NOT swallow errors here — let them propagate so the page can map
 *     `unwrapFieldErrors(error)` (400/409) back onto form fields/cells
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import { createTransfer } from "../api/transfers.api";
import { transferKeys } from "./use-transfers";

export function useCreateTransfer() {
  return useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
    },
  });
}
