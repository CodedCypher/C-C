export type StockState = 'IN_STOCK' | 'LOW' | 'OUT';

/**
 * Derive the stock state from available (onHand - reserved) vs reorderPoint.
 * Matches the original admin.service inventory logic exactly:
 *   available <= 0                              -> OUT
 *   reorderPoint != null && available <= rp     -> LOW
 *   otherwise                                   -> IN_STOCK
 */
export function computeStockState(
  available: number,
  reorderPoint: number | null,
): StockState {
  if (available <= 0) return 'OUT';
  if (reorderPoint !== null && available <= reorderPoint) return 'LOW';
  return 'IN_STOCK';
}
