/**
 * circuit.rocks — products feature barrel.
 *
 * The public surface of the feature. The router imports pages from here; other
 * features (e.g. inventory referencing product types) import types/hooks. This
 * is the canonical export shape every feature should mirror.
 */

// Pages (consumed by the router)
export { ProductsListPage } from "./pages/products-list-page";
export { ProductNewPage } from "./pages/product-new-page";

// Hooks
export { useProducts, productKeys } from "./hooks/use-products";
export { useProductFormOptions } from "./hooks/use-product-form-options";
export { useCreateProduct } from "./hooks/use-create-product";
export { useCreateBrand } from "./hooks/use-create-brand";
export { useCreateCategory } from "./hooks/use-create-category";

// Api (for prefetch / route loaders)
export {
  getProducts,
  getProductFormOptions,
  createProduct,
  createBrand,
  createCategory,
  type ProductsParams,
} from "./api/products.api";

// Types
export {
  productRowSchema,
  formOptionsSchema,
  createProductSchema,
  createProductResultSchema,
  brandOptionSchema,
  categoryOptionSchema,
  warehouseOptionSchema,
  productStatusSchema,
  sourcingTypeSchema,
  MONEY_2,
  MONEY_4,
  SLUG,
  type ProductRow,
  type ProductStatus,
  type SourcingType,
  type FormOptions,
  type BrandOption,
  type CategoryOption,
  type WarehouseOption,
  type CreateProductInput,
  type CreateProductResult,
  type CreateBrandInput,
  type CreateCategoryInput,
} from "./types/products.types";
