/**
 * circuit.rocks — raw-materials feature barrel.
 *
 * The public surface of the feature. The router imports pages from here; other
 * code (e.g. route loaders) can import the api/hooks/types. This mirrors the
 * canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { RawMaterialsListPage } from "./pages/raw-materials-list-page";

// Components (reusable Sheets)
export { RawMaterialFormSheet } from "./components/raw-material-form-sheet";
export { RawMaterialDetailSheet } from "./components/raw-material-detail-sheet";

// Hooks
export { useRawMaterials, rawMaterialKeys } from "./hooks/use-raw-materials";
export { useRawMaterial } from "./hooks/use-raw-material";
export { useWarehouseOptions } from "./hooks/use-warehouse-options";
export { useCreateRawMaterial } from "./hooks/use-create-raw-material";
export { useUpdateRawMaterial } from "./hooks/use-update-raw-material";
export { useDeleteRawMaterial } from "./hooks/use-delete-raw-material";
export { usePublishRawMaterial } from "./hooks/use-publish-raw-material";

// Api (for prefetch / route loaders)
export {
  getRawMaterials,
  getRawMaterial,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  publishRawMaterial,
  getWarehouseOptions,
  type RawMaterialsParams,
} from "./api/raw-materials.api";

// Types
export {
  rawMaterialRowSchema,
  rawMaterialDetailSchema,
  rawMaterialWarehouseSchema,
  rawMaterialMovementSchema,
  warehouseOptionSchema,
  stockStateSchema,
  unitOfMeasureSchema,
  UNITS_OF_MEASURE,
  type RawMaterialRow,
  type RawMaterialDetail,
  type RawMaterialWarehouse,
  type RawMaterialMovement,
  type WarehouseOption,
  type StockState,
  type UnitOfMeasure,
  type CreateRawMaterialInput,
  type UpdateRawMaterialInput,
  type InitialStockInput,
  type CreateRawMaterialResult,
  type DeleteRawMaterialResult,
  type PublishRawMaterialInput,
  type PublishRawMaterialResult,
  type PublishedProduct,
} from "./types/raw-materials.types";
