/**
 * circuit.rocks — warehouses feature barrel.
 *
 * The public surface of the feature. The router imports the page from here;
 * other features may import the row type/hook/api. Mirrors the canonical
 * export shape of the products feature.
 */

// Pages (consumed by the router)
export { WarehousesListPage } from "./pages/warehouses-list-page";

// Hooks
export { useWarehouses, warehouseKeys } from "./hooks/use-warehouses";

// Api (for prefetch / route loaders)
export { getWarehouses } from "./api/warehouses.api";

// Types
export {
  warehouseRowSchema,
  type WarehouseRow,
} from "./types/warehouses.types";
