/**
 * circuit.rocks — payment-methods feature: zod schemas + inferred types.
 *
 * Admin CRUD for the manual payment methods shown at checkout. Mirrors the
 * backend contract (backend/src/payment-methods/payment-methods.service.ts):
 *   - GET /payment-methods        → array of `paymentMethodSchema`
 *   - GET/POST/PATCH /:id         → `paymentMethodSchema`
 *   - DELETE /:id                 → `{ id }`
 *   - POST /:id/qr (multipart)    → `paymentMethodSchema`
 */

import { z } from "zod";

export const paymentMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string().nullable(),
  qrImageUrl: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentMethodIdResultSchema = z.object({ id: z.string() });
export type PaymentMethodIdResult = z.infer<typeof paymentMethodIdResultSchema>;
