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
 * Endpoints are the NEW domain roots (the backend `admin` god-module was split
 * into per-domain modules): GET /orders.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import { orderRowSchema, type OrderRow } from "../types/orders.types";

const ordersPageSchema = paginatedSchema(orderRowSchema);

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
