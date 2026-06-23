/**
 * circuit.rocks — transfers feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints live under the `/stock-transfers` domain root, plus the minimal
 * `GET /warehouses` (source/dest options) and `GET /inventory/options` (line
 * item picker) subsets the create form needs.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import { z } from "zod";
import {
  createTransferResultSchema,
  stockItemOptionSchema,
  transferActionResultSchema,
  transferDetailSchema,
  transferRowSchema,
  transferWarehouseOptionSchema,
  updateTransferResultSchema,
  type CreateTransferInput,
  type CreateTransferResult,
  type ReceiveTransferInput,
  type StockItemOption,
  type StockItemOptionKind,
  type TransferActionResult,
  type TransferDetail,
  type TransferRow,
  type TransferWarehouseOption,
  type UpdateTransferInput,
  type UpdateTransferResult,
} from "../types/transfers.types";

const transfersPageSchema = paginatedSchema(transferRowSchema);
const warehouseOptionsSchema = z.array(transferWarehouseOptionSchema);
const stockItemOptionsSchema = z.array(stockItemOptionSchema);

export interface TransfersParams {
  status?: string;
  q?: string;
  page?: number;
  take?: number;
}

/** GET /stock-transfers — paginated, filterable transfer list. */
export async function getTransfers(
  params: TransfersParams,
): Promise<Paginated<TransferRow>> {
  const res = await api.get("/stock-transfers", { params });
  return transfersPageSchema.parse(res.data);
}

/** GET /stock-transfers/:id — full transfer detail with lines. */
export async function getTransfer(id: string): Promise<TransferDetail> {
  const res = await api.get(`/stock-transfers/${id}`);
  return transferDetailSchema.parse(res.data);
}

/** POST /stock-transfers — create a draft transfer; returns the summary. */
export async function createTransfer(
  body: CreateTransferInput,
): Promise<CreateTransferResult> {
  const res = await api.post("/stock-transfers", body);
  return createTransferResultSchema.parse(res.data);
}

/** PATCH /stock-transfers/:id — edit a DRAFT transfer (notes and/or lines). */
export async function updateTransfer(
  id: string,
  body: UpdateTransferInput,
): Promise<UpdateTransferResult> {
  const res = await api.patch(`/stock-transfers/${id}`, body);
  return updateTransferResultSchema.parse(res.data);
}

/** POST /stock-transfers/:id/request — DRAFT → REQUESTED. */
export async function requestTransfer(
  id: string,
): Promise<TransferActionResult> {
  const res = await api.post(`/stock-transfers/${id}/request`);
  return transferActionResultSchema.parse(res.data);
}

/**
 * POST /stock-transfers/:id/ship — → IN_TRANSIT.
 * May 409 if source stock is insufficient — callers surface that via
 * `unwrapFieldErrors`.
 */
export async function shipTransfer(id: string): Promise<TransferActionResult> {
  const res = await api.post(`/stock-transfers/${id}/ship`);
  return transferActionResultSchema.parse(res.data);
}

/** POST /stock-transfers/:id/receive — record per-line received quantities. */
export async function receiveTransfer(
  id: string,
  body: ReceiveTransferInput,
): Promise<TransferActionResult> {
  const res = await api.post(`/stock-transfers/${id}/receive`, body);
  return transferActionResultSchema.parse(res.data);
}

/** POST /stock-transfers/:id/cancel — → CANCELLED. */
export async function cancelTransfer(
  id: string,
): Promise<TransferActionResult> {
  const res = await api.post(`/stock-transfers/${id}/cancel`);
  return transferActionResultSchema.parse(res.data);
}

/**
 * GET /warehouses — parse just the option subset the source/dest <select>s
 * need. (The full warehouses feature lives elsewhere; we don't import it.)
 */
export async function getTransferWarehouseOptions(): Promise<
  TransferWarehouseOption[]
> {
  const res = await api.get("/warehouses");
  return warehouseOptionsSchema.parse(res.data);
}

/**
 * GET /inventory/options — searchable stock-item picker for transfer lines.
 * `q` filters by name/SKU; `kind` optionally narrows to VARIANT or MATERIAL.
 */
export async function getStockItemOptions(params: {
  q?: string;
  kind?: StockItemOptionKind;
}): Promise<StockItemOption[]> {
  const res = await api.get("/inventory/options", { params });
  return stockItemOptionsSchema.parse(res.data);
}
