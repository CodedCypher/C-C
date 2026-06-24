/**
 * circuit.rocks — public storefront layout (pathless `storefrontRoute` shell).
 *
 * Wraps every public page (home, PDP, checkout) in the shared chrome —
 * AnnouncementBar + NavHeader + Footer — plus the CartDrawer and its open-state
 * context. The nav cart badge reads the live cart count from `useCart`, and its
 * button opens the drawer. This replaces the chrome the home page used to render
 * inline, so all storefront pages stay consistent.
 */

import { Outlet } from "@tanstack/react-router";

import { MEGA } from "../data";
import { useCart } from "../hooks/use-storefront";
import { AnnouncementBar } from "./announcement-bar";
import { CartUIProvider, useCartUI } from "./cart-context";
import { CartDrawer } from "./cart-drawer";
import { Footer } from "./footer";
import { NavHeader } from "./nav-header";

function StorefrontChrome() {
  const { openCart } = useCartUI();
  const { data: cart } = useCart();

  return (
    <>
      <AnnouncementBar />
      <NavHeader cartCount={cart?.count ?? 0} megaMenu={MEGA} onCartClick={openCart} />
      <Outlet />
      <Footer />
      <CartDrawer />
    </>
  );
}

export function StorefrontLayout() {
  return (
    <CartUIProvider>
      <StorefrontChrome />
    </CartUIProvider>
  );
}
