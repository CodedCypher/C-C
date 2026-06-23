import * as React from "react";
import { ResponsiveContainer } from "recharts";

/**
 * circuit.rocks admin — ChartFrame
 *
 * Recharts' `ResponsiveContainer` measures the DOM to size itself, which the
 * server cannot do — rendering it during SSR/first paint causes a hydration
 * mismatch. This frame guards against that: it renders a static skeleton block
 * of `height` on the server and the very first client paint, then (after the
 * mount effect flips `mounted`) swaps in a real `ResponsiveContainer` wrapping
 * `children`. The container's children must be a single Recharts chart element.
 */
export function ChartFrame({
  height = 260,
  children,
}: {
  height?: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        role="img"
        aria-label="Loading chart"
        style={{ height }}
        className="w-full animate-pulse border-2 border-line bg-paper-2 motion-reduce:animate-none"
      />
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height={height}>
        {/* Recharts requires a single chart element child here. */}
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
