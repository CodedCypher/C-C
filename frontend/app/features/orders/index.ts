/**
 * circuit.rocks — orders feature barrel.
 *
 * The public surface of the feature. The router imports pages from here; other
 * code (e.g. route loaders) can import the api/hooks/types. This mirrors the
 * canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { OrdersListPage } from "./pages/orders-list-page";
export { OrderDetailPage } from "./pages/order-detail-page";

// Components (reused by the customer-facing account hub)
export { OrderStepper } from "./components/order-stepper";

// Hooks
export {
  useOrders,
  useOrder,
  useWarehouseOptions,
  orderKeys,
} from "./hooks/use-orders";
export {
  useUploadPaymentProof,
  useVerifyPayment,
  useRejectPayment,
  useShipOrder,
  useDeliverOrder,
  useCancelOrder,
} from "./hooks/use-order-actions";

// Api (for prefetch / route loaders)
export {
  getOrders,
  getOrder,
  type OrdersParams,
} from "./api/orders.api";

// Types
export {
  orderRowSchema,
  orderStatusSchema,
  orderDetailSchema,
  type OrderRow,
  type OrderStatus,
  type OrderDetail,
  type OrderLineInfo,
  type PaymentInfo,
  type FulfillmentInfo,
} from "./types/orders.types";
