/**
 * circuit.rocks — dashboard feature: dashboard page.
 *
 * Ported from the old SSR `routes/admin/dashboard.tsx`. The server loader is
 * gone: data comes from `useDashboard()` (axios → GET /dashboard). While the
 * query is loading we render skeletons; on error a shared EmptyState. The
 * brutalist UI (KPI grid, secondary stat tiles, charts, low-stock / recent /
 * top-product tables) is preserved verbatim from the old route.
 *
 * CANONICAL PATTERN for a read-only detail page:
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton / loading affordances while loading
 *   - render the shared DataTable / charts / MetricCard otherwise
 */

import type { ReactNode } from "react";
import { Download, PackageSearch, ShoppingCart } from "lucide-react";

import {
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  RevenueChart,
  StatusChart,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import { formatDate, peso } from "~/lib/format";
import { useDashboard } from "../hooks/use-dashboard";
import type {
  Dashboard,
  LowStockRow,
  RecentOrder,
  TopProduct,
} from "../types/dashboard.types";

/** Brutalist titled panel: bordered card with a mono uppercase header bar. */
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col border-2 border-line bg-paper shadow-brutal">
      <header className="flex items-center justify-between gap-3 border-b-2 border-line px-4 py-3">
        <h2 className="cr-mono text-ink">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

/** Small KPI tile for the secondary operations row (no chart, compact). */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 border-2 border-line bg-paper-2 p-4 shadow-press">
      <span className="cr-micro text-smoke">{label}</span>
      <span className="font-sans text-[1.5rem] font-bold leading-none tracking-[-0.02em] text-ink">
        {value}
      </span>
    </div>
  );
}

const lowStockColumns: Column<LowStockRow>[] = [
  {
    key: "name",
    header: "Item",
    render: (r) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{r.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{r.sku}</span>
      </div>
    ),
  },
  {
    key: "available",
    header: "Avail / Reorder",
    align: "right",
    render: (r) => (
      <span className="font-mono">
        <span className={r.available <= 0 ? "text-soldout" : "text-hazard"}>
          {r.available}
        </span>
        <span className="text-dark-meta"> / {r.reorderPoint}</span>
      </span>
    ),
  },
  {
    key: "state",
    header: "Status",
    align: "right",
    render: (r) => (
      <StatusPill kind="stock" value={r.available <= 0 ? "OUT" : "LOW"} />
    ),
  },
];

const recentOrderColumns: Column<RecentOrder>[] = [
  {
    key: "orderNumber",
    header: "Order #",
    render: (r) => <span className="font-mono text-ink">{r.orderNumber}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (r) => <span className="text-ink">{r.customer}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (r) => <StatusPill kind="order" value={r.status} />,
  },
  {
    key: "grandTotal",
    header: "Total",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{peso(r.grandTotal)}</span>,
  },
  {
    key: "placedAt",
    header: "Date",
    align: "right",
    render: (r) => (
      <span className="whitespace-nowrap text-smoke">
        {formatDate(r.placedAt)}
      </span>
    ),
  },
];

const topProductColumns: Column<TopProduct>[] = [
  {
    key: "title",
    header: "Product",
    render: (r) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{r.title}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{r.sku}</span>
      </div>
    ),
  },
  {
    key: "unitsSold",
    header: "Units",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{r.unitsSold}</span>,
  },
  {
    key: "revenue",
    header: "Revenue",
    align: "right",
    render: (r) => <span className="font-mono text-ink">{peso(r.revenue)}</span>,
  },
];

export function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Dashboard"
        description={`Today's snapshot — ${today}. Revenue, orders and stock at a glance.`}
        actions={
          <Button variant="secondary" size="sm">
            <Download className="size-4" aria-hidden="true" />
            Export
          </Button>
        }
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <EmptyState
          icon={<PackageSearch className="size-6" aria-hidden="true" />}
          title="Could not load the dashboard"
          description="Something went wrong fetching today's metrics. Try again."
        />
      ) : (
        <DashboardContent data={data} />
      )}
    </div>
  );
}

/** Loading affordance mirroring the page's section rhythm. */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse border-2 border-line bg-paper-2 motion-reduce:animate-none"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse border-2 border-line bg-paper-2 motion-reduce:animate-none"
            />
          ))}
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div
            key={i}
            className="h-[340px] animate-pulse border-2 border-line bg-paper-2 motion-reduce:animate-none"
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TableSkeleton rows={6} cols={3} />
        <TableSkeleton rows={6} cols={5} />
      </section>
      <section>
        <TableSkeleton rows={6} cols={3} />
      </section>
    </div>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  const {
    kpis,
    revenueSeries,
    ordersByStatus,
    lowStock,
    topProducts,
    recentOrders,
  } = data;

  return (
    <>
      {/* ── KPI grid ── */}
      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Revenue"
            value={peso(kpis.revenue)}
            deltaPct={kpis.revenueDeltaPct}
            accent
            sparkline={revenueSeries.map((r) => r.revenue)}
          />
          <MetricCard
            label="Orders"
            value={kpis.orders.toLocaleString()}
            deltaPct={kpis.ordersDeltaPct}
            sparkline={revenueSeries.map((r) => r.orders)}
          />
          <MetricCard label="Avg. Order Value" value={peso(kpis.aov)} />
          <MetricCard
            label="New Customers"
            value={kpis.newCustomers.toLocaleString()}
            deltaPct={kpis.newCustomersDeltaPct}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Low Stock" value={kpis.lowStockCount.toLocaleString()} />
          <StatTile
            label="Open Build Orders"
            value={kpis.openBuildOrders.toLocaleString()}
          />
          <StatTile
            label="Open POs"
            value={kpis.openPurchaseOrders.toLocaleString()}
          />
          <StatTile
            label="Pending Fulfillments"
            value={kpis.pendingFulfillments.toLocaleString()}
          />
        </div>
      </section>

      {/* ── Charts row ── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Revenue · last 30 days">
          {revenueSeries.length > 0 ? (
            <RevenueChart data={revenueSeries} />
          ) : (
            <EmptyState
              title="No revenue yet"
              description="Revenue will appear here once orders start coming in."
            />
          )}
        </Panel>
        <Panel title="Orders by status">
          {ordersByStatus.length > 0 ? (
            <StatusChart data={ordersByStatus} />
          ) : (
            <EmptyState
              title="No orders yet"
              description="Order status breakdown will appear here."
            />
          )}
        </Panel>
      </section>

      {/* ── Bottom row ── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Low stock"
          action={
            <a
              href="/inventory?filter=low"
              className="cr-micro text-smoke underline-offset-2 hover:text-ink hover:underline"
            >
              View all
            </a>
          }
        >
          <DataTable<LowStockRow>
            columns={lowStockColumns}
            rows={lowStock}
            getRowKey={(r) => r.sku}
            empty={
              <EmptyState
                icon={<PackageSearch className="size-6" aria-hidden="true" />}
                title="Stock looks healthy"
                description="Nothing is below its reorder point right now."
              />
            }
          />
        </Panel>

        <Panel
          title="Recent orders"
          action={
            <a
              href="/orders"
              className="cr-micro text-smoke underline-offset-2 hover:text-ink hover:underline"
            >
              View all
            </a>
          }
        >
          <DataTable<RecentOrder>
            columns={recentOrderColumns}
            rows={recentOrders}
            getRowKey={(r) => r.orderNumber}
            empty={
              <EmptyState
                icon={<ShoppingCart className="size-6" aria-hidden="true" />}
                title="No orders yet"
                description="New orders will show up here as they're placed."
              />
            }
          />
        </Panel>
      </section>

      {/* ── Top products strip ── */}
      <section>
        <Panel
          title="Top products"
          action={
            <a
              href="/products?status=ACTIVE"
              className="cr-micro text-smoke underline-offset-2 hover:text-ink hover:underline"
            >
              View all
            </a>
          }
        >
          <DataTable<TopProduct>
            columns={topProductColumns}
            rows={topProducts}
            getRowKey={(r) => r.sku}
            empty={
              <EmptyState
                title="No sales data"
                description="Best-selling products will appear here."
              />
            }
          />
        </Panel>
      </section>
    </>
  );
}
