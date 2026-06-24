/**
 * circuit.rocks — payment-methods feature barrel.
 * Exports the page (router imports this) + hooks/api/types.
 */

export { PaymentMethodsListPage } from "./pages/payment-methods-list-page";

export {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  useUploadPaymentMethodQr,
  paymentMethodKeys,
} from "./hooks/use-payment-methods";

export {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  uploadPaymentMethodQr,
} from "./api/payment-methods.api";

export {
  paymentMethodSchema,
  type PaymentMethod,
  type PaymentMethodIdResult,
} from "./types/payment-methods.types";
