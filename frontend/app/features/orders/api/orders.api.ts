/**
 * circuit.rocks — orders feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints live under the `/orders` domain root, plus the minimal
 * `GET /warehouses` subset the ship-from override <select> needs.
 */

import { z } from "zod";
import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import {
  orderActionResultSchema,
  orderDetailSchema,
  orderRowSchema,
  paymentInfoSchema,
  warehouseOptionSchema,
  type OrderActionResult,
  type OrderDetail,
  type OrderRow,
  type PaymentInfo,
  type ShipOrderInput,
  type WarehouseOption,
} from "../types/orders.types";

const ordersPageSchema = paginatedSchema(orderRowSchema);
const warehouseOptionsSchema = z.array(warehouseOptionSchema);

export interface OrdersParams {
  status?: string;
  q?: string;
  page?: number;
  take?: number;
}

/** GET /orders — paginated, filterable order list. */
export async function getOrders(
  params: OrdersParams,
): Promise<Paginated<OrderRow>> {
  const res = await api.get("/orders", { params });
  return ordersPageSchema.parse(res.data);
}

/** GET /orders/:id — full order detail (lines, address, payment, fulfillment). */
export async function getOrder(id: string): Promise<OrderDetail> {
  const res = await api.get(`/orders/${id}`);
  return orderDetailSchema.parse(res.data);
}

/**
 * POST /orders/:id/payment-proof — multipart upload of a manual-payment proof
 * image (+ optional reference). Returns the updated payment record.
 */
export async function uploadPaymentProof(
  id: string,
  file: File,
  reference?: string,
): Promise<PaymentInfo> {
  const form = new FormData();
  form.append("file", file);
  if (reference) form.append("reference", reference);
  const res = await api.post(`/orders/${id}/payment-proof`, form);
  return paymentInfoSchema.parse(res.data);
}

/** POST /orders/:id/verify-payment — PENDING → CONFIRMED (reserves stock). */
export async function verifyPayment(id: string): Promise<OrderActionResult> {
  const res = await api.post(`/orders/${id}/verify-payment`);
  return orderActionResultSchema.parse(res.data);
}

/** POST /orders/:id/reject-payment — mark proof rejected; stays PENDING. */
export async function rejectPayment(
  id: string,
  reason?: string,
): Promise<OrderActionResult> {
  const res = await api.post(`/orders/${id}/reject-payment`, { reason });
  return orderActionResultSchema.parse(res.data);
}

/**
 * POST /orders/:id/ship — CONFIRMED → FULFILLED (deducts stock).
 * May 409 if the ship-from warehouse has insufficient stock — callers surface
 * that via `unwrapFieldErrors` and let the admin override the warehouse.
 */
export async function shipOrder(
  id: string,
  body: ShipOrderInput,
): Promise<OrderActionResult> {
  const res = await api.post(`/orders/${id}/ship`, body);
  return orderActionResultSchema.parse(res.data);
}

/** POST /orders/:id/deliver — FULFILLED → COMPLETED. */
export async function deliverOrder(id: string): Promise<OrderActionResult> {
  const res = await api.post(`/orders/${id}/deliver`);
  return orderActionResultSchema.parse(res.data);
}

/** POST /orders/:id/cancel — PENDING/CONFIRMED → CANCELLED (releases stock). */
export async function cancelOrder(id: string): Promise<OrderActionResult> {
  const res = await api.post(`/orders/${id}/cancel`);
  return orderActionResultSchema.parse(res.data);
}

/** GET /warehouses — option subset for the ship-from override <select>. */
export async function getWarehouseOptions(): Promise<WarehouseOption[]> {
  const res = await api.get("/warehouses");
  return warehouseOptionsSchema.parse(res.data);
}
