/**
 * circuit.rocks — orders feature: manual-payment + fulfillment mutation hooks.
 *
 * One mutation per write the detail page can perform: upload proof, verify,
 * reject, ship, deliver, cancel. They all follow the CANONICAL pattern:
 *   - `useMutation({ mutationFn })` bound to the order `id`
 *   - on success invalidate BOTH the detail (`orderKeys.detail(id)`, so the
 *     stepper + action bar repaint from fresh status) AND every list
 *     (`orderKeys.all`, so the list status column stays in sync)
 *   - errors propagate (NOT swallowed) so the page maps 409/400 via
 *     `unwrapFieldErrors` — e.g. ship can 409 on insufficient warehouse stock
 */

import { useMutation } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  cancelOrder,
  deliverOrder,
  rejectPayment,
  shipOrder,
  uploadPaymentProof,
  verifyPayment,
} from "../api/orders.api";
import { orderKeys } from "./use-orders";
import type { ShipOrderInput } from "../types/orders.types";

/** Invalidate the detail + every list after a write touching order `id`. */
function invalidateOrder(id: string): void {
  queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: orderKeys.all });
}

/** POST /orders/:id/payment-proof — upload a manual-payment proof image. */
export function useUploadPaymentProof(id: string) {
  return useMutation({
    mutationFn: (body: { file: File; reference?: string }) =>
      uploadPaymentProof(id, body.file, body.reference),
    onSuccess: () => invalidateOrder(id),
  });
}

/** POST /orders/:id/verify-payment — PENDING → CONFIRMED (reserves stock). */
export function useVerifyPayment(id: string) {
  return useMutation({
    mutationFn: () => verifyPayment(id),
    onSuccess: () => invalidateOrder(id),
  });
}

/** POST /orders/:id/reject-payment — mark proof rejected; stays PENDING. */
export function useRejectPayment(id: string) {
  return useMutation({
    mutationFn: (reason?: string) => rejectPayment(id, reason),
    onSuccess: () => invalidateOrder(id),
  });
}

/** POST /orders/:id/ship — CONFIRMED → FULFILLED (may 409 on stock). */
export function useShipOrder(id: string) {
  return useMutation({
    mutationFn: (body: ShipOrderInput) => shipOrder(id, body),
    onSuccess: () => invalidateOrder(id),
  });
}

/** POST /orders/:id/deliver — FULFILLED → COMPLETED. */
export function useDeliverOrder(id: string) {
  return useMutation({
    mutationFn: () => deliverOrder(id),
    onSuccess: () => invalidateOrder(id),
  });
}

/** POST /orders/:id/cancel — PENDING/CONFIRMED → CANCELLED (releases stock). */
export function useCancelOrder(id: string) {
  return useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: () => invalidateOrder(id),
  });
}
