/**
 * circuit.rocks — inventory feature barrel.
 *
 * The public surface of the feature. The router imports pages from here; other
 * code (e.g. route loaders) can import the api/hooks/types. This mirrors the
 * canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { InventoryListPage } from "./pages/inventory-list-page";
export { InventoryItemPage } from "./pages/inventory-item-page";

// Hooks
export { useInventory, inventoryKeys } from "./hooks/use-inventory";
export { useInventoryItem } from "./hooks/use-inventory-item";
export { useAdjustStock } from "./hooks/use-adjust-stock";
export { useSetReorder, useSetWarehouseReorder } from "./hooks/use-set-reorder";
export { useWarehouseOptions } from "./hooks/use-warehouse-options";

// Api (for prefetch / route loaders)
export {
  getInventory,
  getInventoryItem,
  adjustStock,
  setReorder,
  setWarehouseReorder,
  getWarehouseOptions,
  type InventoryParams,
  type AdjustStockBody,
  type SetReorderBody,
} from "./api/inventory.api";

// Types
export {
  inventoryRowSchema,
  inventoryDetailSchema,
  inventoryWarehouseLevelSchema,
  inventoryMovementSchema,
  adjustResultSchema,
  warehouseOptionSchema,
  inventoryKindSchema,
  stockStateSchema,
  type InventoryRow,
  type InventoryDetail,
  type InventoryWarehouseLevel,
  type InventoryMovement,
  type AdjustResult,
  type WarehouseOption,
  type InventoryKind,
  type StockState,
} from "./types/inventory.types";
