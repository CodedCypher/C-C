/**
 * circuit.rocks — storefront cart-UI context.
 *
 * Holds ONLY the drawer's open/close state (cart *contents* live in TanStack
 * Query via `useCart`). Lifted to the storefront layout so the nav cart button,
 * the PDP "Add" button and the drawer itself all share one open state.
 */

import { createContext, useContext, useMemo, useState } from "react";

interface CartUI {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  setOpen: (open: boolean) => void;
}

const CartUIContext = createContext<CartUI | null>(null);

export function CartUIProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo<CartUI>(
    () => ({
      open,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      setOpen,
    }),
    [open],
  );
  return (
    <CartUIContext.Provider value={value}>{children}</CartUIContext.Provider>
  );
}

export function useCartUI(): CartUI {
  const ctx = useContext(CartUIContext);
  if (!ctx) {
    throw new Error("useCartUI must be used within a CartUIProvider");
  }
  return ctx;
}
