/**
 * circuit.rocks — build-orders feature barrel.
 *
 * Public surface: the router imports pages from here; other code can import the
 * api/hooks/types. Mirrors the canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { BuildOrdersListPage } from "./pages/build-orders-list-page";
export { BuildOrderNewPage } from "./pages/build-order-new-page";
export { BuildOrderDetailPage } from "./pages/build-order-detail-page";

// Hooks
export { useBuildOrders, buildOrderKeys } from "./hooks/use-build-orders";
export { useBuildOrder } from "./hooks/use-build-order";
export { useCreateBuildOrder } from "./hooks/use-create-build-order";
export {
  usePlanBuildOrder,
  useStartBuildOrder,
  useCompleteBuildOrder,
  useCancelBuildOrder,
} from "./hooks/use-build-order-actions";
export { useBuildWarehouseOptions } from "./hooks/use-build-warehouse-options";
export { useBomVariantOptions } from "./hooks/use-bom-variant-options";

// Types
export {
  buildOrderRowSchema,
  buildOrderDetailSchema,
  buildOrderStatusSchema,
  createBuildOrderSchema,
  completeBuildOrderSchema,
  bomVariantOptionSchema,
  buildWarehouseOptionSchema,
  type BuildOrderRow,
  type BuildOrderDetail,
  type BuildOrderStatus,
  type BuildOrderComponent,
  type BuildOrderConsumption,
  type BuildOrderOutput,
  type CreateBuildOrderInput,
  type CompleteBuildOrderInput,
  type BomVariantOption,
  type BuildWarehouseOption,
} from "./types/build-orders.types";
