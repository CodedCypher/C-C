/**
 * circuit.rocks — orders feature barrel.
 *
 * The public surface of the feature. The router imports pages from here; other
 * code (e.g. route loaders) can import the api/hooks/types. This mirrors the
 * canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { OrdersListPage } from "./pages/orders-list-page";

// Hooks
export { useOrders, orderKeys } from "./hooks/use-orders";

// Api (for prefetch / route loaders)
export { getOrders, type OrdersParams } from "./api/orders.api";

// Types
export {
  orderRowSchema,
  orderStatusSchema,
  type OrderRow,
  type OrderStatus,
} from "./types/orders.types";
