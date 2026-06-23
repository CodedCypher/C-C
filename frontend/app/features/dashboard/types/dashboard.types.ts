/**
 * circuit.rocks — dashboard feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the dashboard domain. They
 * mirror the backend `GET /dashboard` response — i.e. `DashboardMetrics` in
 * `backend/src/dashboard/dashboard.service.ts` — exactly (kept in sync by hand,
 * no codegen). TS types come from `z.infer`.
 *
 * The chart row schemas (`revenuePointSchema`, `statusCountSchema`) are
 * structurally compatible with the shared charts' local `RevenuePoint` /
 * `StatusCount` prop types, so the inferred data passes straight through.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * KPIs (GET /dashboard → kpis)
 * ------------------------------------------------------------------ */

export const dashboardKpisSchema = z.object({
  revenue: z.number(),
  revenueDeltaPct: z.number(),
  orders: z.number(),
  ordersDeltaPct: z.number(),
  aov: z.number(),
  newCustomers: z.number(),
  newCustomersDeltaPct: z.number(),
  lowStockCount: z.number(),
  openBuildOrders: z.number(),
  openPurchaseOrders: z.number(),
  pendingFulfillments: z.number(),
});
export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;

/* ------------------------------------------------------------------ *
 * Revenue series (GET /dashboard → revenueSeries)
 * Mirrors the shared RevenueChart's `RevenuePoint`.
 * ------------------------------------------------------------------ */

export const revenuePointSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  orders: z.number(),
});
export type RevenuePoint = z.infer<typeof revenuePointSchema>;

/* ------------------------------------------------------------------ *
 * Orders by status (GET /dashboard → ordersByStatus)
 * Mirrors the shared StatusChart's `StatusCount`.
 * ------------------------------------------------------------------ */

export const statusCountSchema = z.object({
  status: z.string(),
  count: z.number(),
});
export type StatusCount = z.infer<typeof statusCountSchema>;

/* ------------------------------------------------------------------ *
 * Low stock list (GET /dashboard → lowStock)
 * ------------------------------------------------------------------ */

export const lowStockRowSchema = z.object({
  name: z.string(),
  sku: z.string(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  reorderPoint: z.number(),
  uom: z.string(),
});
export type LowStockRow = z.infer<typeof lowStockRowSchema>;

/* ------------------------------------------------------------------ *
 * Top products (GET /dashboard → topProducts)
 * ------------------------------------------------------------------ */

export const topProductSchema = z.object({
  title: z.string(),
  sku: z.string(),
  unitsSold: z.number(),
  revenue: z.number(),
});
export type TopProduct = z.infer<typeof topProductSchema>;

/* ------------------------------------------------------------------ *
 * Recent orders (GET /dashboard → recentOrders)
 * ------------------------------------------------------------------ */

export const recentOrderSchema = z.object({
  orderNumber: z.string(),
  customer: z.string(),
  status: z.string(),
  grandTotal: z.number(),
  placedAt: z.string().nullable(),
});
export type RecentOrder = z.infer<typeof recentOrderSchema>;

/* ------------------------------------------------------------------ *
 * Full GET /dashboard response — mirrors DashboardMetrics
 * ------------------------------------------------------------------ */

export const dashboardSchema = z.object({
  kpis: dashboardKpisSchema,
  revenueSeries: z.array(revenuePointSchema),
  ordersByStatus: z.array(statusCountSchema),
  lowStock: z.array(lowStockRowSchema),
  topProducts: z.array(topProductSchema),
  recentOrders: z.array(recentOrderSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
