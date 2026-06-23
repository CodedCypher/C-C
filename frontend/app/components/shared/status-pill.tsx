import { Badge } from "~/components/ui/badge";

/**
 * circuit.rocks admin — StatusPill
 *
 * Central map from domain enum values → Badge variant + a nicely-cased label.
 * One source of truth so every table / detail view paints status identically.
 *
 * `kind` scopes the lookup so the same string (e.g. "OPEN") can mean different
 * things in different domains. Unknown values fall back to `neutral` with a
 * title-cased version of the raw enum.
 */

type BadgeVariant = "neutral" | "signal" | "sale" | "stock" | "soldout" | "clone";

export type StatusKind =
  | "order"
  | "po"
  | "build"
  | "stock"
  | "fulfillment"
  | "transfer";

interface StatusMeta {
  variant: BadgeVariant;
  label: string;
}

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Per-domain enum → variant maps. Labels default to title-cased enum. */
const MAPS: Record<StatusKind, Record<string, BadgeVariant>> = {
  order: {
    COMPLETED: "stock",
    FULFILLED: "stock",
    PAID: "stock",
    PENDING: "neutral",
    CONFIRMED: "neutral",
    PROCESSING: "signal",
    ON_HOLD: "signal",
    CANCELLED: "soldout",
    CANCELED: "soldout",
    REFUNDED: "soldout",
    FAILED: "soldout",
  },
  po: {
    RECEIVED: "stock",
    CLOSED: "stock",
    OPEN: "signal",
    PARTIAL: "signal",
    DRAFT: "neutral",
    ORDERED: "neutral",
    CANCELLED: "soldout",
    CANCELED: "soldout",
  },
  build: {
    DONE: "stock",
    COMPLETED: "stock",
    OPEN: "signal",
    IN_PROGRESS: "signal",
    PLANNED: "neutral",
    DRAFT: "neutral",
    CANCELLED: "soldout",
    CANCELED: "soldout",
  },
  stock: {
    IN_STOCK: "stock",
    LOW: "signal",
    OUT: "soldout",
    OUT_OF_STOCK: "soldout",
  },
  fulfillment: {
    SHIPPED: "stock",
    DELIVERED: "stock",
    FULFILLED: "stock",
    PENDING: "neutral",
    PACKED: "signal",
    PROCESSING: "signal",
    CANCELLED: "soldout",
    CANCELED: "soldout",
    FAILED: "soldout",
  },
  transfer: {
    RECEIVED: "stock",
    IN_TRANSIT: "signal",
    PARTIALLY_RECEIVED: "signal",
    REQUESTED: "neutral",
    DRAFT: "neutral",
    CANCELLED: "soldout",
    CANCELED: "soldout",
  },
};

/** Friendlier labels for a few enums that don't title-case nicely. */
const LABEL_OVERRIDES: Record<string, string> = {
  IN_STOCK: "In Stock",
  OUT: "Out of Stock",
  OUT_OF_STOCK: "Out of Stock",
  ON_HOLD: "On Hold",
  IN_PROGRESS: "In Progress",
  IN_TRANSIT: "In Transit",
  PARTIALLY_RECEIVED: "Partially Received",
  PARTIALLY_FULFILLED: "Partially Fulfilled",
};

function resolve(kind: StatusKind, value: string): StatusMeta {
  const key = (value ?? "").toString().trim().toUpperCase();
  const variant = MAPS[kind]?.[key] ?? "neutral";
  const label = LABEL_OVERRIDES[key] ?? titleCase(key || "Unknown");
  return { variant, label };
}

export function StatusPill({
  kind,
  value,
}: {
  kind: StatusKind;
  value: string;
}) {
  const { variant, label } = resolve(kind, value);
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}
