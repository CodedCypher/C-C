/**
 * circuit.rocks — payment-methods feature: api layer (pure data access against
 * the guarded `/payment-methods` admin endpoints; every response is parsed
 * through a zod schema). Writes propagate backend 400/409 un-caught so pages
 * map them via `unwrapFieldErrors`.
 */

import { z } from "zod";

import { api } from "~/lib/axios";
import {
  paymentMethodSchema,
  paymentMethodIdResultSchema,
  type PaymentMethod,
  type PaymentMethodIdResult,
} from "../types/payment-methods.types";

const paymentMethodListSchema = z.array(paymentMethodSchema);

/** GET /payment-methods — full list (admin). */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await api.get("/payment-methods");
  return paymentMethodListSchema.parse(res.data);
}

/** Body for POST /payment-methods. */
export interface CreatePaymentMethodBody {
  name: string;
  instructions?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** POST /payment-methods — create. */
export async function createPaymentMethod(
  body: CreatePaymentMethodBody,
): Promise<PaymentMethod> {
  const res = await api.post("/payment-methods", body);
  return paymentMethodSchema.parse(res.data);
}

/** Body for PATCH /payment-methods/:id — partial update. */
export interface UpdatePaymentMethodBody {
  name?: string;
  instructions?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** PATCH /payment-methods/:id — partial update. */
export async function updatePaymentMethod(
  id: string,
  body: UpdatePaymentMethodBody,
): Promise<PaymentMethod> {
  const res = await api.patch(`/payment-methods/${id}`, body);
  return paymentMethodSchema.parse(res.data);
}

/** DELETE /payment-methods/:id. */
export async function deletePaymentMethod(
  id: string,
): Promise<PaymentMethodIdResult> {
  const res = await api.delete(`/payment-methods/${id}`);
  return paymentMethodIdResultSchema.parse(res.data);
}

/** POST /payment-methods/:id/qr — upload/replace the QR image (multipart). */
export async function uploadPaymentMethodQr(
  id: string,
  file: File,
): Promise<PaymentMethod> {
  const form = new FormData();
  form.set("file", file);
  const res = await api.post(`/payment-methods/${id}/qr`, form);
  return paymentMethodSchema.parse(res.data);
}
