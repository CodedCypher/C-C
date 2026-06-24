/**
 * circuit.rocks — build-orders feature: single build-order detail query hook.
 *
 * Loads `GET /build-orders/:id` for the detail page. Disabled until `id` is
 * present (router param). Lifecycle mutations invalidate
 * `buildOrderKeys.detail(id)` so the action bar repaints from fresh server state.
 */

import { useQuery } from "@tanstack/react-query";

import { getBuildOrder } from "../api/build-orders.api";
import { buildOrderKeys } from "./use-build-orders";

export function useBuildOrder(id: string) {
  return useQuery({
    queryKey: buildOrderKeys.detail(id),
    queryFn: () => getBuildOrder(id),
    enabled: Boolean(id),
  });
}
