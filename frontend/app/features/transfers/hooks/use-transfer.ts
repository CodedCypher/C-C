/**
 * circuit.rocks — transfers feature: single-transfer detail query hook.
 *
 * Loads `GET /stock-transfers/:id` for the detail page. Disabled until `id` is
 * present (router param). Lifecycle mutations invalidate `transferKeys.detail(id)`
 * so the action bar repaints from fresh server state.
 */

import { useQuery } from "@tanstack/react-query";

import { getTransfer } from "../api/transfers.api";
import { transferKeys } from "./use-transfers";

export function useTransfer(id: string) {
  return useQuery({
    queryKey: transferKeys.detail(id),
    queryFn: () => getTransfer(id),
    enabled: Boolean(id),
  });
}
