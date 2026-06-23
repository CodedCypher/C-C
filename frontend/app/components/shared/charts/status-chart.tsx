import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame } from "./chart-frame";

/** Minimal shape this chart renders. Mirrors the dashboard's StatusCount. */
export interface StatusCount {
  status: string;
  count: number;
}

/**
 * circuit.rocks admin — StatusChart
 *
 * Horizontal bar chart of orders-by-status, brand-styled: ink bars with a
 * signal accent on the largest bucket, mono labels, hard grid, and a custom
 * brutalist tooltip. No default recharts rounding.
 */

const AXIS_TICK = {
  fill: "var(--smoke)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
} as const;

/** Title-case an enum value for axis labels ("ON_HOLD" → "On Hold"). */
function labelize(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface StatusTooltipEntry {
  payload?: StatusCount;
  value?: number | string;
}

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: StatusTooltipEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="border-2 border-line bg-paper px-3 py-2 shadow-brutal">
      <p className="cr-micro mb-1 text-smoke">{labelize(point.status)}</p>
      <p className="font-sans text-[1.0625rem] font-bold leading-none tracking-[-0.01em] text-ink">
        {point.count} {point.count === 1 ? "order" : "orders"}
      </p>
    </div>
  );
}

export function StatusChart({ data }: { data: StatusCount[] }) {
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);

  return (
    <ChartFrame height={Math.max(200, data.length * 44 + 24)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        barCategoryGap="28%"
      >
        <CartesianGrid
          stroke="var(--line)"
          strokeOpacity={0.12}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="status"
          tickFormatter={labelize}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--line)" }}
          width={110}
        />
        <Tooltip
          content={<StatusTooltip />}
          cursor={{ fill: "var(--ink)", fillOpacity: 0.06 }}
        />
        <Bar dataKey="count" stroke="var(--line)" strokeWidth={2} maxBarSize={28} isAnimationActive={false}>
          {data.map((d) => (
            <Cell
              key={d.status}
              fill={d.count === max && max > 0 ? "var(--signal)" : "var(--ink)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
