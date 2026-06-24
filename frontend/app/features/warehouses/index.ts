/**
 * circuit.rocks — warehouses feature barrel.
 *
 * The public surface of the feature. The router imports the pages from here;
 * other features may import the row type/hook/api. Mirrors the canonical
 * export shape of the products feature.
 */

// Pages (consumed by the router)
export { WarehousesListPage } from "./pages/warehouses-list-page";
export { WarehouseDetailPage } from "./pages/warehouse-detail-page";

// Hooks
export {
  useWarehouses,
  useWarehouse,
  useWarehouseStock,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  warehouseKeys,
} from "./hooks/use-warehouses";

// Api (for prefetch / route loaders)
export {
  getWarehouses,
  getWarehouse,
  getWarehouseStock,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  type WarehouseStockParams,
  type CreateWarehouseBody,
  type UpdateWarehouseBody,
} from "./api/warehouses.api";

// Types
export {
  warehouseRowSchema,
  warehouseDetailSchema,
  warehouseStockRowSchema,
  warehouseStockSummarySchema,
  warehouseCreatedSchema,
  warehouseIdResultSchema,
  warehouseTypeSchema,
  warehouseStockKindSchema,
  stockStateSchema,
  warehouseTypeLabel,
  WAREHOUSE_TYPES,
  type WarehouseRow,
  type WarehouseDetail,
  type WarehouseStockRow,
  type WarehouseStockSummary,
  type WarehouseCreated,
  type WarehouseIdResult,
  type WarehouseType,
  type WarehouseStockKind,
  type StockState,
} from "./types/warehouses.types";
