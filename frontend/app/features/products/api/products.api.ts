/**
 * circuit.rocks — products feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file:
 *   - import the shared `api` axios instance and the feature's zod schemas
 *   - one async function per endpoint; each returns the typed, PARSED response
 *     (`schema.parse(res.data)`) so callers get runtime-validated data
 *   - list endpoints parse through `paginatedSchema(rowSchema)`
 *   - no react/query here — this layer is pure data access, called by hooks
 *
 * Endpoints are the NEW domain roots (the backend `admin` god-module was split
 * into per-domain modules): GET /products, GET /products/form-options,
 * POST /products, POST /products/brands, POST /products/categories.
 */

import { api } from "~/lib/axios";
import { paginatedSchema, type Paginated } from "~/lib/pagination";
import {
  brandOptionSchema,
  categoryOptionSchema,
  createProductResultSchema,
  formOptionsSchema,
  productRowSchema,
  type BrandOption,
  type CategoryOption,
  type CreateBrandInput,
  type CreateCategoryInput,
  type CreateProductInput,
  type CreateProductResult,
  type FormOptions,
  type ProductRow,
} from "../types/products.types";

const productsPageSchema = paginatedSchema(productRowSchema);

export interface ProductsParams {
  status?: string;
  q?: string;
  page?: number;
  take?: number;
}

/** GET /products — paginated, filterable product list. */
export async function getProducts(
  params: ProductsParams,
): Promise<Paginated<ProductRow>> {
  const res = await api.get("/products", { params });
  return productsPageSchema.parse(res.data);
}

/** GET /products/form-options — brand/category/warehouse options. */
export async function getProductFormOptions(): Promise<FormOptions> {
  const res = await api.get("/products/form-options");
  return formOptionsSchema.parse(res.data);
}

/** POST /products — create a product; returns the created summary. */
export async function createProduct(
  body: CreateProductInput,
): Promise<CreateProductResult> {
  const res = await api.post("/products", body);
  return createProductResultSchema.parse(res.data);
}

/** POST /products/brands — inline-create a brand. */
export async function createBrand(
  body: CreateBrandInput,
): Promise<BrandOption> {
  const res = await api.post("/products/brands", body);
  return brandOptionSchema.parse(res.data);
}

/** POST /products/categories — inline-create a category. */
export async function createCategory(
  body: CreateCategoryInput,
): Promise<CategoryOption> {
  const res = await api.post("/products/categories", body);
  return categoryOptionSchema.parse(res.data);
}
