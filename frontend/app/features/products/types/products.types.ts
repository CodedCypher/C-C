/**
 * circuit.rocks — products feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the products domain. They:
 *   1. validate API responses in `api/products.api.ts` (every call `.parse()`s),
 *   2. produce TS types via `z.infer` (no hand-written interfaces), and
 *   3. mirror the backend's class-validator DTO (`backend/src/admin/dto/
 *      create-product.dto.ts`) for the create-product payload — kept in sync by
 *      hand (no codegen), so MONEY_2 / MONEY_4 / SLUG are re-declared here.
 *
 * CANONICAL PATTERN for a feature's types file:
 *   - one `xxxSchema` + `export type Xxx = z.infer<typeof xxxSchema>` per shape
 *   - row schema for list rows, option schemas for form selects
 *   - a `createXxxSchema` mirroring the backend DTO for the create form
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Backend-mirrored validation primitives (see create-product.dto.ts)
 * ------------------------------------------------------------------ */

/** 2dp money (price / compareAtPrice). */
export const MONEY_2 = /^\d{1,10}(\.\d{1,2})?$/;
/** 4dp money (stock quantities — Prisma Decimal(14,4)). */
export const MONEY_4 = /^\d{1,10}(\.\d{1,4})?$/;
/** Slug: lowercase words separated by single hyphens. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** URL: absolute http(s) OR root-relative path. */
export const IMAGE_URL = /^(https?:\/\/|\/)/;

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const sourcingTypeSchema = z.enum(["PURCHASED", "BUILT"]);
export type SourcingType = z.infer<typeof sourcingTypeSchema>;

/* ------------------------------------------------------------------ *
 * List row (GET /products)
 * ------------------------------------------------------------------ */

export const productRowSchema = z.object({
  title: z.string(),
  slug: z.string(),
  brand: z.string().nullable(),
  status: productStatusSchema,
  variantCount: z.number(),
  priceMin: z.number(),
  priceMax: z.number(),
  totalOnHand: z.number(),
  primaryImage: z.string().nullable(),
});
export type ProductRow = z.infer<typeof productRowSchema>;

/* ------------------------------------------------------------------ *
 * Form options (GET /products/form-options)
 * ------------------------------------------------------------------ */

export const brandOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type BrandOption = z.infer<typeof brandOptionSchema>;

export const categoryOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type CategoryOption = z.infer<typeof categoryOptionSchema>;

export const warehouseOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  isDefaultWeb: z.boolean(),
});
export type WarehouseOption = z.infer<typeof warehouseOptionSchema>;

export const formOptionsSchema = z.object({
  brands: z.array(brandOptionSchema),
  categories: z.array(categoryOptionSchema),
  warehouses: z.array(warehouseOptionSchema),
});
export type FormOptions = z.infer<typeof formOptionsSchema>;

/* ------------------------------------------------------------------ *
 * Create result (POST /products)
 * ------------------------------------------------------------------ */

export const createProductResultSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  variantCount: z.number(),
});
export type CreateProductResult = z.infer<typeof createProductResultSchema>;

/* ------------------------------------------------------------------ *
 * Create-product payload (POST /products) — mirrors CreateProductDto
 * ------------------------------------------------------------------ */

const optionValueInputSchema = z.object({
  value: z.string().min(1).max(80),
});

const optionTypeInputSchema = z.object({
  name: z.string().min(1).max(80),
  values: z.array(optionValueInputSchema).min(1),
});

const variantStockInputSchema = z.object({
  warehouseId: z.string().min(1),
  onHand: z.string().regex(MONEY_4, {
    message: "onHand must be a number with up to 4 decimals",
  }),
});

const variantInputSchema = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().max(64).optional(),
  title: z.string().max(120).optional(),
  sourcingType: sourcingTypeSchema,
  price: z.string().regex(MONEY_2, {
    message: "price must be a number with up to 2 decimals",
  }),
  compareAtPrice: z
    .string()
    .regex(MONEY_2, {
      message: "compareAtPrice must be a number with up to 2 decimals",
    })
    .optional(),
  weightGrams: z.number().int().min(0).optional(),
  isActive: z.boolean(),
  optionValues: z.array(z.string()),
  reorderPoint: z
    .string()
    .regex(MONEY_4, {
      message: "reorderPoint must be a number with up to 4 decimals",
    })
    .optional(),
  reorderQty: z
    .string()
    .regex(MONEY_4, {
      message: "reorderQty must be a number with up to 4 decimals",
    })
    .optional(),
  stock: z.array(variantStockInputSchema),
});

const imageInputSchema = z.object({
  url: z.string().regex(IMAGE_URL, {
    message: "url must be an absolute http(s) or root-relative path",
  }),
  alt: z.string().max(160).optional(),
  isPrimary: z.boolean(),
  variantIndex: z.number().int().min(0).optional(),
});

const specInputSchema = z.object({
  group: z.string().optional(),
  key: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().optional(),
});

export const createProductSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .max(200)
    .regex(SLUG, {
      message: "slug must be lowercase words separated by single hyphens",
    }),
  description: z.string().optional(),
  status: productStatusSchema,
  brandId: z.string().optional(),
  categoryIds: z.array(z.string()),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  optionTypes: z.array(optionTypeInputSchema),
  variants: z.array(variantInputSchema).min(1),
  images: z.array(imageInputSchema),
  specs: z.array(specInputSchema),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

/* ------------------------------------------------------------------ *
 * Inline brand/category create payloads (POST /products/brands|categories)
 * ------------------------------------------------------------------ */

export const createBrandSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
