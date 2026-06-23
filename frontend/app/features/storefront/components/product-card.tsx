import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

/**
 * circuit.rocks — ProductCard (DISCIPLINED zone)
 * Bordered square frame, clean product photo on paper, mono stock badge over image,
 * mono SKU, Grotesk title (2-line clamp), large mono price, compact ADD button.
 * Lifts with a hard shadow + press on hover. Calm — this repeats in grids.
 */
const HATCH =
  "repeating-linear-gradient(45deg, transparent, transparent 11px, rgba(20,20,20,0.04) 11px, rgba(20,20,20,0.04) 12px)";

type StockBadge = { label: string; variant: "stock" | "soldout" | "signal" };

export function ProductCard({
  title,
  sku,
  price,
  image,
  imageLabel,
  stock,
  badge,
  href = "#",
  onAdd,
}: {
  title: string;
  sku?: string;
  price: string;
  image?: string;
  imageLabel?: string;
  stock?: number | null;
  badge?: StockBadge;
  href?: string;
  onAdd?: () => void;
}) {
  const soldOut = stock === 0;
  const computedBadge: StockBadge | null =
    badge ??
    (soldOut
      ? { label: "SOLD OUT", variant: "soldout" }
      : typeof stock === "number"
        ? { label: `${stock} STOCK`, variant: "stock" }
        : null);

  return (
    <div className="cr-press flex flex-col border-2 border-line bg-paper shadow-brutal hover:shadow-press active:shadow-none">
      {/* Image frame */}
      <a
        href={href}
        className="relative block aspect-square overflow-hidden border-b-2 border-line bg-paper"
      >
        {computedBadge && (
          <span className="absolute left-2 top-2 z-[2]">
            <Badge variant={computedBadge.variant} size="sm">
              {computedBadge.label}
            </Badge>
          </span>
        )}
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full p-3.5 [mix-blend-mode:multiply] [object-fit:contain]"
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5"
            style={{ backgroundImage: HATCH }}
          >
            <div className="h-[46%] w-[46%] border-2 border-line bg-paper-2" />
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-smoke">
              img: {imageLabel || "product.jpg"}
            </span>
          </div>
        )}
      </a>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {sku && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            SKU: {sku}
          </span>
        )}
        <a
          href={href}
          className="line-clamp-2 min-h-[2.4em] font-sans text-[0.9375rem] font-semibold leading-[1.25] text-ink no-underline"
        >
          {title}
        </a>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="font-mono text-[1.0625rem] font-bold text-ink">
            {price}
          </span>
          <button
            onClick={onAdd}
            disabled={soldOut}
            className={cn(
              "border-2 border-line px-3.5 py-2 font-sans text-xs font-bold uppercase tracking-[0.04em]",
              soldOut
                ? "cursor-not-allowed bg-paper-2 text-smoke shadow-none"
                : "cr-press cursor-pointer bg-signal text-ink shadow-press active:shadow-none",
            )}
          >
            {soldOut ? "NOTIFY" : "ADD"}
          </button>
        </div>
      </div>
    </div>
  );
}
