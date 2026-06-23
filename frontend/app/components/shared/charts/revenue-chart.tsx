import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { peso } from "~/lib/format";

import { ChartFrame } from "./chart-frame";

/** Minimal shape this chart renders. Mirrors the dashboard's RevenuePoint. */
export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * circuit.rocks admin — RevenueChart
 *
 * Revenue-over-time area chart, restyled to brand: signal fill + stroke, ink
 * axes, small mono tick fonts, hard (no-radius) cartesian grid, and a custom
 * brutalist tooltip (bg-paper, 2px border, hard shadow) showing the date,
 * ₱revenue, and order count. No default recharts rounding or drop shadow.
 */

const AXIS_TICK = {
  fill: "var(--smoke)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
} as const;

/** Format an ISO/date string as a short "Jun 23" axis tick. */
function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Compact peso for the Y axis ("₱12k"). */
function compactPeso(value: number): string {
  if (Math.abs(value) >= 1000) return `₱${Math.round(value / 1000)}k`;
  return `₱${value}`;
}

interface TooltipEntry {
  payload?: RevenuePoint;
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="border-2 border-line bg-paper px-3 py-2 shadow-brutal">
      <p className="cr-micro mb-1 text-smoke">
        {shortDate(String(label ?? point.date))}
      </p>
      <p className="font-sans text-[1.0625rem] font-bold leading-none tracking-[-0.01em] text-ink">
        {peso(point.revenue)}
      </p>
      <p className="mt-1 font-mono text-[0.75rem] uppercase tracking-[0.06em] text-smoke">
        {point.orders} {point.orders === 1 ? "order" : "orders"}
      </p>
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ChartFrame height={280}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
      >
        <defs>
          <linearGradient id="cr-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--line)"
          strokeOpacity={0.12}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={compactPeso}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          width={48}
        />
        <Tooltip
          content={<RevenueTooltip />}
          cursor={{ stroke: "var(--ink)", strokeWidth: 1, strokeOpacity: 0.4 }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--ink)"
          strokeWidth={2}
          fill="url(#cr-revenue-fill)"
          activeDot={{
            r: 4,
            fill: "var(--signal)",
            stroke: "var(--ink)",
            strokeWidth: 2,
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartFrame>
  );
}
