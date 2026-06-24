/**
 * circuit.rocks — build-orders feature: lifecycle mutation hooks.
 *
 * One mutation per write the detail page can perform: plan, start, complete,
 * cancel. They all follow the CANONICAL mutation pattern:
 *   - `useMutation({ mutationFn })` bound to the build-order `id`
 *   - on success invalidate BOTH the detail (`buildOrderKeys.detail(id)`, so the
 *     action bar repaints from fresh status) AND every list
 *     (`buildOrderKeys.all`, so the list status column stays in sync)
 *   - errors propagate (NOT swallowed) so the page maps 409/400 via
 *     `unwrapFieldErrors` — e.g. plan can 409 on unavailable components, and
 *     complete can 400/409 on shortfalls
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  cancelBuildOrder,
  completeBuildOrder,
  planBuildOrder,
  startBuildOrder,
} from "../api/build-orders.api";
import { buildOrderKeys } from "./use-build-orders";
import type { CompleteBuildOrderInput } from "../types/build-orders.types";

/** Invalidate the detail + every list after a write touching build-order `id`. */
function invalidateBuildOrder(id: string): void {
  queryClient.invalidateQueries({ queryKey: buildOrderKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: buildOrderKeys.all });
}

/** POST /build-orders/:id/plan — DRAFT → PLANNED (may 409). */
export function usePlanBuildOrder(id: string) {
  return useMutation({
    mutationFn: () => planBuildOrder(id),
    onSuccess: () => invalidateBuildOrder(id),
  });
}

/** POST /build-orders/:id/start — → IN_PROGRESS. */
export function useStartBuildOrder(id: string) {
  return useMutation({
    mutationFn: () => startBuildOrder(id),
    onSuccess: () => invalidateBuildOrder(id),
  });
}

/** POST /build-orders/:id/complete — → COMPLETED (may 400/409). */
export function useCompleteBuildOrder(id: string) {
  return useMutation({
    mutationFn: (body: CompleteBuildOrderInput) =>
      completeBuildOrder(id, body),
    onSuccess: () => invalidateBuildOrder(id),
  });
}

/** POST /build-orders/:id/cancel — → CANCELLED. */
export function useCancelBuildOrder(id: string) {
  return useMutation({
    mutationFn: () => cancelBuildOrder(id),
    onSuccess: () => invalidateBuildOrder(id),
  });
}
