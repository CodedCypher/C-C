import { z } from "zod";

/**
 * zod schemas are the source of truth for the project-kits feature; TS types are
 * inferred from them. The api layer parses every response through these.
 */

// Money string accepted by the kit-price input (2dp) and part quantity (4dp).
const MONEY_2 = /^\d{1,10}(\.\d{1,2})?$/;
const QTY_4 = /^\d{1,10}(\.\d{1,4})?$/;

export const kitStockStateSchema = z.enum(["IN_STOCK", "LOW", "OUT"]);
export type KitStockState = z.infer<typeof kitStockStateSchema>;

// ── List row ───────────────────────────────────────────────────────────────
export const projectKitRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  sku: z.string(),
  primaryImage: z.string().nullable(),
  productStatus: z.string(),
  kitPrice: z.number(),
  partsTotal: z.number(),
  partCount: z.number().int().nonnegative(),
  inStockCount: z.number().int().nonnegative(),
  allInStock: z.boolean(),
  published: z.boolean(),
  position: z.number().int(),
});
export type ProjectKitRow = z.infer<typeof projectKitRowSchema>;

export const projectKitsListSchema = z.array(projectKitRowSchema);

// ── Detail (edit form) ──────────────────────────────────────────────────────
export const projectKitPartSchema = z.object({
  stockItemId: z.string(),
  variantId: z.string(),
  sku: z.string(),
  name: z.string(),
  uom: z.string(),
  image: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  available: z.number(),
  availability: z.string(),
  canAdd: z.boolean(),
});
export type ProjectKitPart = z.infer<typeof projectKitPartSchema>;

export const projectKitDetailSchema = projectKitRowSchema.extend({
  description: z.string().nullable(),
  parts: z.array(projectKitPartSchema),
});
export type ProjectKitDetail = z.infer<typeof projectKitDetailSchema>;

// ── Mutation results ────────────────────────────────────────────────────────
export const kitIdResultSchema = z.object({ id: z.string() });
export type KitIdResult = z.infer<typeof kitIdResultSchema>;

export const kitPublishResultSchema = z.object({
  id: z.string(),
  published: z.boolean(),
});
export const kitMoveResultSchema = z.object({
  id: z.string(),
  moved: z.boolean(),
});

// ── Catalog part option (from GET /inventory/options?kind=VARIANT) ──────────
export const kitPartOptionSchema = z.object({
  stockItemId: z.string(),
  kind: z.enum(["VARIANT", "MATERIAL"]),
  name: z.string(),
  sku: z.string(),
  uom: z.string(),
  standardCost: z.number().nullable(),
  price: z.number().nullable(),
});
export type KitPartOption = z.infer<typeof kitPartOptionSchema>;
export const kitPartOptionsSchema = z.array(kitPartOptionSchema);

// ── Create / update payload validation (mirrors the backend DTOs) ───────────
export const kitPartInputSchema = z.object({
  stockItemId: z.string().min(1, "Pick a catalog product."),
  quantity: z.string().regex(QTY_4, {
    message: "Quantity must be a number with up to 4 decimals.",
  }),
});
export type KitPartInput = z.infer<typeof kitPartInputSchema>;

export const createProjectKitSchema = z.object({
  title: z.string().min(1, "A title is required.").max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z
    .string()
    .regex(/^(https?:\/\/|\/)/, {
      message: "Image must be an absolute http(s) or root-relative URL.",
    })
    .max(2048)
    .optional(),
  kitPrice: z.string().regex(MONEY_2, {
    message: "Kit price must be a number with up to 2 decimals.",
  }),
  parts: z.array(kitPartInputSchema).min(1, "Add at least one part."),
});
export type CreateProjectKitInput = z.infer<typeof createProjectKitSchema>;
