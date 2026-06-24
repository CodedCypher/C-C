/**
 * circuit.rocks — branches feature barrel.
 *
 * The public surface of the feature. The router imports the pages from here;
 * other features may import the row type/hooks/api. Mirrors the canonical export
 * shape every feature uses.
 */

// Pages (consumed by the router)
export { BranchesListPage } from "./pages/branches-list-page";
export { BranchDetailPage } from "./pages/branch-detail-page";

// Hooks
export {
  useBranches,
  useBranch,
  useBranchInventory,
  useBranchWarehouseOptions,
  useCreateBranch,
  useUpdateBranch,
  useSetBranchWarehouses,
  branchKeys,
} from "./hooks/use-branches";

// Api (for prefetch / route loaders)
export {
  getBranches,
  getBranch,
  getBranchInventory,
  getBranchWarehouseOptions,
  createBranch,
  updateBranch,
  setBranchWarehouses,
  branchWarehouseOptionSchema,
  type BranchInventoryParams,
  type CreateBranchBody,
  type UpdateBranchBody,
  type BranchWarehouseLinkInput,
  type BranchWarehouseOption,
} from "./api/branches.api";

// Types
export {
  branchRowSchema,
  branchDetailSchema,
  branchWarehouseLinkSchema,
  branchInventoryRowSchema,
  branchInventoryByWarehouseSchema,
  branchCreatedSchema,
  branchIdResultSchema,
  branchStockKindSchema,
  stockStateSchema,
  type BranchRow,
  type BranchDetail,
  type BranchWarehouseLink,
  type BranchInventoryRow,
  type BranchInventoryByWarehouse,
  type BranchCreated,
  type BranchIdResult,
  type BranchStockKind,
  type StockState,
} from "./types/branches.types";
