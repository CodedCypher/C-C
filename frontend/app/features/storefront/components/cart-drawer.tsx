/**
 * circuit.rocks — storefront cart drawer.
 *
 * Slide-over (right) Sheet driven by `useCartUI` (open state) + `useCart`
 * (contents). Lines support qty −/+ and remove via the cart mutation hooks; the
 * footer shows the subtotal and a "Checkout" link to /checkout (which closes the
 * drawer). Empty state nudges back to shopping.
 */

import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { peso2 } from "~/lib/format";

import {
  useCart,
  useRemoveCartLine,
  useUpdateCartLine,
} from "../hooks/use-storefront";
import { useCartUI } from "./cart-context";

export function CartDrawer() {
  const { open, setOpen, closeCart } = useCartUI();
  const { data: cart, isLoading } = useCart();
  const updateLine = useUpdateCartLine();
  const removeLine = useRemoveCartLine();

  const lines = cart?.lines ?? [];
  const busy = updateLine.isPending || removeLine.isPending;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            // your cart{cart?.count ? ` · ${cart.count}` : ""}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6">
          {isLoading ? (
            <p className="font-mono text-[0.8125rem] text-smoke">Loading…</p>
          ) : lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <ShoppingCart className="size-8 text-smoke" aria-hidden="true" />
              <p className="font-sans text-[0.9375rem] font-semibold text-ink">
                Your cart is empty
              </p>
              <p className="max-w-[16rem] text-[0.8125rem] text-smoke">
                Browse the catalog and add a few parts to get started.
              </p>
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={line.variantId}
                className="flex gap-3 border-2 border-line bg-paper p-3 shadow-press"
              >
                <div className="flex size-16 shrink-0 items-center justify-center border-2 border-line bg-paper-2">
                  {line.image ? (
                    <img
                      src={line.image}
                      alt=""
                      className="size-full object-contain p-1 [mix-blend-mode:multiply]"
                      loading="lazy"
                    />
                  ) : (
                    <ShoppingCart
                      className="size-5 text-smoke"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    to="/products/$slug"
                    params={{ slug: line.productSlug }}
                    onClick={closeCart}
                    className="truncate font-sans text-[0.875rem] font-semibold text-ink hover:underline"
                  >
                    {line.name}
                  </Link>
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
                    {peso2(line.unitPrice)}
                  </span>

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center border-2 border-line">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={busy}
                        onClick={() =>
                          updateLine.mutate({
                            variantId: line.variantId,
                            quantity: line.quantity - 1,
                          })
                        }
                        className="flex size-7 items-center justify-center text-ink hover:bg-signal disabled:opacity-50"
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-7 text-center font-mono text-[0.8125rem] text-ink">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={busy}
                        onClick={() =>
                          updateLine.mutate({
                            variantId: line.variantId,
                            quantity: line.quantity + 1,
                          })
                        }
                        className="flex size-7 items-center justify-center text-ink hover:bg-signal disabled:opacity-50"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.875rem] font-bold text-ink">
                        {peso2(line.lineTotal)}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove item"
                        disabled={busy}
                        onClick={() => removeLine.mutate(line.variantId)}
                        className="flex size-7 items-center justify-center text-smoke hover:text-soldout disabled:opacity-50"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <SheetFooter className="border-t-2 border-line">
          <div className="flex items-center justify-between font-mono text-[0.9375rem] font-bold text-ink">
            <span>Subtotal</span>
            <span>{peso2(cart?.subtotal ?? 0)}</span>
          </div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            Shipping & taxes calculated at checkout
          </p>
          <Button
            asChild
            variant="primary"
            size="lg"
            className="w-full"
            disabled={lines.length === 0}
          >
            <Link to="/checkout" onClick={closeCart}>
              Checkout →
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
