/**
 * circuit.rocks — orders feature: fulfillment stepper.
 *
 * A 4-step linear progress indicator driven purely by `OrderStatus`:
 *   Pending → Paid → Shipped → Delivered
 *
 * The furthest reached milestone is derived from the status; earlier steps
 * render "done", the reached one "current", later ones "upcoming". CANCELLED /
 * REFUNDED are terminal — the stepper is replaced by a distinct banner.
 *
 * Brutalist styling: square number tiles, 2px borders, hard offset connectors.
 */

import { Ban } from "lucide-react";

import { cn } from "~/lib/utils";
import type { OrderStatus } from "../types/orders.types";

const STEPS = ["Pending", "Paid", "Shipped", "Delivered"] as const;

/** Index of the furthest reached step for a given status. */
const REACHED: Record<OrderStatus, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PARTIALLY_FULFILLED: 2,
  FULFILLED: 2,
  COMPLETED: 3,
  CANCELLED: -1,
  REFUNDED: -1,
};

type StepState = "done" | "current" | "upcoming";

export function OrderStepper({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED" || status === "REFUNDED") {
    const label = status === "CANCELLED" ? "Cancelled" : "Refunded";
    return (
      <div className="flex items-center gap-3 border-2 border-soldout bg-soldout/10 px-4 py-3 shadow-press">
        <Ban className="size-5 text-soldout" aria-hidden="true" />
        <span className="font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-soldout">
          Order {label} — fulfillment stopped
        </span>
      </div>
    );
  }

  const reached = REACHED[status];
  const isComplete = status === "COMPLETED";

  function stateOf(i: number): StepState {
    if (isComplete || i < reached) return "done";
    if (i === reached) return "current";
    return "upcoming";
  }

  return (
    <ol className="flex w-full items-center border-2 border-line bg-paper px-4 py-4 shadow-press">
      {STEPS.map((label, i) => {
        const state = stateOf(i);
        const last = i === STEPS.length - 1;
        return (
          <li
            key={label}
            className={cn("flex items-center", !last && "flex-1")}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center border-2 border-line font-mono text-[0.8125rem] font-bold shadow-press",
                  state === "done" && "bg-ink text-paper",
                  state === "current" && "bg-signal text-ink",
                  state === "upcoming" && "bg-paper text-smoke",
                )}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
                  state === "upcoming" ? "text-smoke" : "text-ink",
                )}
              >
                {label}
              </span>
            </div>
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-3 h-0.5 flex-1",
                  i < reached ? "bg-ink" : "bg-line",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
