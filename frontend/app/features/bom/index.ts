/**
 * circuit.rocks — bom feature barrel.
 *
 * Public surface: the router imports pages from here; other code can import the
 * api/hooks/types. Mirrors the canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { BomListPage } from "./pages/bom-list-page";
export { BomEditorPage } from "./pages/bom-editor-page";

// Hooks
export {
  bomKeys,
  useBomVariants,
  useBomVersions,
  useBom,
  useBomExplosion,
  useBomCost,
  useBomWhereUsed,
  useBomFeasibility,
  useBomStockItemOptions,
  useBomWarehouseOptions,
} from "./hooks/use-bom";
export {
  useCreateBom,
  useUpdateBom,
  useActivateBom,
} from "./hooks/use-bom-mutations";

// Api (for prefetch / route loaders)
export {
  getBomVariants,
  getBomVersions,
  getBom,
  explodeBom,
  getBomCost,
  getBomWhereUsed,
  getBomFeasibility,
  createBom,
  updateBom,
  activateBom,
  getBomStockItemOptions,
  getBomWarehouseOptions,
  type BomVariantsParams,
} from "./api/bom.api";

// Types
export {
  bomVariantRowSchema,
  bomVersionSchema,
  bomDetailSchema,
  bomExplosionSchema,
  bomCostSchema,
  bomFeasibilitySchema,
  bomWhereUsedSchema,
  createBomSchema,
  updateBomSchema,
  unitOfMeasureSchema,
  UNIT_OPTIONS,
  type BomVariantRow,
  type BomVersion,
  type BomDetail,
  type BomLine,
  type BomExplosion,
  type BomExplosionNode,
  type BomLeaf,
  type BomCost,
  type BomCostLine,
  type BomFeasibility,
  type BomShortfall,
  type BomWhereUsed,
  type CreateBomInput,
  type UpdateBomInput,
  type BomLineInput,
  type BomWriteResult,
  type BomStockItemOption,
  type BomWarehouseOption,
  type UnitOfMeasure,
  type BomInputKind,
} from "./types/bom.types";
