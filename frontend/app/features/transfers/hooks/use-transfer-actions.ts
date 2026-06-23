/**
 * circuit.rocks — transfers feature: lifecycle + edit mutation hooks.
 *
 * One mutation per write the detail page can perform: edit a DRAFT, request,
 * ship, receive, cancel. They all follow the CANONICAL mutation pattern:
 *   - `useMutation({ mutationFn })` bound to the transfer `id`
 *   - on success invalidate BOTH the detail (`transferKeys.detail(id)`, so the
 *     action bar repaints from fresh status) AND every list (`transferKeys.all`,
 *     so the list status column stays in sync)
 *   - errors propagate (NOT swallowed) so the page maps 409/400 via
 *     `unwrapFieldErrors` — e.g. ship can 409 on insufficient source stock
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  cancelTransfer,
  receiveTransfer,
  requestTransfer,
  shipTransfer,
  updateTransfer,
} from "../api/transfers.api";
import { transferKeys } from "./use-transfers";
import type {
  ReceiveTransferInput,
  UpdateTransferInput,
} from "../types/transfers.types";

/** Invalidate the detail + every list after a write touching transfer `id`. */
function invalidateTransfer(id: string): void {
  queryClient.invalidateQueries({ queryKey: transferKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: transferKeys.all });
}

/** PATCH /stock-transfers/:id — edit a DRAFT (notes and/or lines). */
export function useUpdateTransfer(id: string) {
  return useMutation({
    mutationFn: (body: UpdateTransferInput) => updateTransfer(id, body),
    onSuccess: () => invalidateTransfer(id),
  });
}

/** POST /stock-transfers/:id/request — DRAFT → REQUESTED. */
export function useRequestTransfer(id: string) {
  return useMutation({
    mutationFn: () => requestTransfer(id),
    onSuccess: () => invalidateTransfer(id),
  });
}

/** POST /stock-transfers/:id/ship — → IN_TRANSIT (may 409). */
export function useShipTransfer(id: string) {
  return useMutation({
    mutationFn: () => shipTransfer(id),
    onSuccess: () => invalidateTransfer(id),
  });
}

/** POST /stock-transfers/:id/receive — record per-line received quantities. */
export function useReceiveTransfer(id: string) {
  return useMutation({
    mutationFn: (body: ReceiveTransferInput) => receiveTransfer(id, body),
    onSuccess: () => invalidateTransfer(id),
  });
}

/** POST /stock-transfers/:id/cancel — → CANCELLED. */
export function useCancelTransfer(id: string) {
  return useMutation({
    mutationFn: () => cancelTransfer(id),
    onSuccess: () => invalidateTransfer(id),
  });
}
