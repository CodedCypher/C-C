/**
 * circuit.rocks — shared component kit barrel.
 *
 * Cross-feature UI relocated from the old `components/admin`. Feature pages do:
 *   import { PageHeader, DataTable, Pagination, type Column } from
 *     "~/components/shared";
 */

export { AdminLayout } from "./admin-layout";
export { Sidebar } from "./sidebar";
export { Topbar } from "./topbar";
export { PageHeader, type PageHeaderTab } from "./page-header";
export { MetricCard } from "./metric-card";
export { StatusPill, type StatusKind } from "./status-pill";
export { DataTable, type Column } from "./data-table";
export { Pagination } from "./pagination";
export { EmptyState } from "./empty-state";
export { TableSkeleton } from "./table-skeleton";

export { ChartFrame } from "./charts/chart-frame";
export { RevenueChart, type RevenuePoint } from "./charts/revenue-chart";
export { StatusChart, type StatusCount } from "./charts/status-chart";
