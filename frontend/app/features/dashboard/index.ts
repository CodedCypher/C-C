/**
 * circuit.rocks — dashboard feature barrel.
 *
 * The public surface of the feature. The router imports the page from here; the
 * api/hooks/types are exported for prefetch (route loaders) and any consumer that
 * needs the dashboard shape. Mirrors the canonical barrel shape (pages + hooks +
 * api + types).
 */

// Pages (consumed by the router)
export { DashboardPage } from "./pages/dashboard-page";

// Hooks
export { useDashboard, dashboardKeys } from "./hooks/use-dashboard";

// Api (for prefetch / route loaders)
export { getDashboard } from "./api/dashboard.api";

// Types
export {
  dashboardSchema,
  dashboardKpisSchema,
  revenuePointSchema,
  statusCountSchema,
  lowStockRowSchema,
  topProductSchema,
  recentOrderSchema,
  type Dashboard,
  type DashboardKpis,
  type RevenuePoint,
  type StatusCount,
  type LowStockRow,
  type TopProduct,
  type RecentOrder,
} from "./types/dashboard.types";
