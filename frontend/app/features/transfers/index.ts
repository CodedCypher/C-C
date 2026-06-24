/**
 * circuit.rocks — transfers feature barrel.
 *
 * Public surface: the router imports pages from here; other code can import the
 * api/hooks/types. Mirrors the canonical export shape every feature uses.
 */

// Pages (consumed by the router)
export { TransfersListPage } from "./pages/transfers-list-page";
export { TransferNewPage } from "./pages/transfer-new-page";
export { TransferDetailPage } from "./pages/transfer-detail-page";

// Hooks
export { useTransfers, transferKeys } from "./hooks/use-transfers";
export { useTransfer } from "./hooks/use-transfer";
export { useCreateTransfer } from "./hooks/use-create-transfer";
export {
  useUpdateTransfer,
  useRequestTransfer,
  useShipTransfer,
  useReceiveTransfer,
  useCancelTransfer,
} from "./hooks/use-transfer-actions";

// Types
export {
  transferRowSchema,
  transferDetailSchema,
  transferStatusSchema,
  type TransferRow,
  type TransferDetail,
  type TransferStatus,
} from "./types/transfers.types";
