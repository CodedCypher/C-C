/**
 * circuit.rocks — account feature barrel.
 *
 * The customer-facing "account hub". The router imports the pages from here;
 * hooks/api/types are re-exported for any other consumer. Mirrors the canonical
 * export shape every feature uses.
 */

// Pages (consumed by the router)
export { AccountLayout } from "./pages/account-layout";
export { MyOrdersPage } from "./pages/my-orders-page";
export { MyOrderDetailPage } from "./pages/my-order-detail-page";
export { AddressesPage } from "./pages/addresses-page";
export { ProfilePage } from "./pages/profile-page";

// Components
export { AddressForm } from "./components/address-form";

// Hooks
export {
  useMyProfile,
  useUpdateProfile,
  useMyOrders,
  useMyOrder,
  accountKeys,
} from "./hooks/use-account";

// Api (for prefetch / route loaders)
export {
  getMyProfile,
  updateMyProfile,
  getMyOrders,
  getMyOrder,
  type MyOrdersParams,
} from "./api/account.api";

// Types
export {
  profileSchema,
  profileInputSchema,
  myOrderRowSchema,
  myOrdersSchema,
  myOrderDetailSchema,
  type Profile,
  type ProfileInput,
  type MyOrderRow,
  type MyOrderDetail,
  type MyOrderLine,
  type MyOrderAddress,
  type MyOrderPayment,
  type MyOrderFulfillment,
} from "./types/account.types";
