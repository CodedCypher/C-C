import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

/**
 * circuit.rocks admin — MetricCard
 *
 * A KPI tile: mono uppercase label, a big fixed-size Space Grotesk value,
 * an optional delta chip (▲ green / ▼ red with % and a "30d" caption), and an
 * optional hand-built inline SVG sparkline (signal stroke). Fixed type scale —
 * no fluid clamp (this is the admin register).
 */

/** Build an SVG polyline `points` string + an area path from a number series. */
function sparkGeometry(values: number[], w: number, h: number, pad = 2) {
  const n = values.length;
  if (n === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    // invert Y (SVG origin top-left) and normalise into the inner box
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area =
    `M ${pts[0][0].toFixed(2)},${(h - pad).toFixed(2)} ` +
    pts.map(([x, y]) => `L ${x.toFixed(2)},${y.toFixed(2)}`).join(" ") +
    ` L ${pts[n - 1][0].toFixed(2)},${(h - pad).toFixed(2)} Z`;

  return { line, area };
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 32;
  const geo = sparkGeometry(values, w, h);
  if (!geo) return null;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
      preserveAspectRatio="none"
    >
      <path d={geo.area} fill="var(--signal)" fillOpacity={0.18} stroke="none" />
      <polyline
        points={geo.line}
        fill="none"
        stroke="var(--signal)"
        strokeWidth={2}
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
    </svg>
  );
}

function DeltaChip({ deltaPct }: { deltaPct: number }) {
  const up = deltaPct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1 border-2 border-line px-1.5 py-0.5 font-mono text-[0.6875rem] font-bold uppercase leading-none tracking-[0.06em]",
          up ? "text-stock" : "text-soldout",
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {up ? "+" : ""}
        {deltaPct.toFixed(1)}%
      </span>
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-dark-meta">
        30d
      </span>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  deltaPct,
  sparkline,
  accent,
}: {
  label: string;
  value: string;
  deltaPct?: number;
  sparkline?: number[];
  accent?: boolean;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="cr-mono text-smoke">{label}</span>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline values={sparkline} />
        ) : null}
      </div>

      <div
        className={cn(
          "mt-3 font-sans text-[2rem] font-bold leading-none tracking-[-0.02em]",
          accent ? "text-signal" : "text-ink",
        )}
      >
        {value}
      </div>

      {deltaPct !== undefined ? (
        <div className="mt-3">
          <DeltaChip deltaPct={deltaPct} />
        </div>
      ) : null}
    </Card>
  );
}
