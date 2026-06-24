/**
 * circuit.rocks — account feature: the account-hub shell (pathless layout).
 *
 * Renders INSIDE the public storefront shell (it's a child of the storefront
 * layout via the router), so it must NOT re-render the NavHeader / Footer. It
 * adds a heading + a brutalist sub-nav (Orders / Addresses / Profile) and an
 * `<Outlet/>` for the active account page.
 */

import { Link, Outlet } from "@tanstack/react-router";
import { MapPin, ShoppingBag, User } from "lucide-react";

const MAXW = "mx-auto max-w-[980px]";

const NAV = [
  { to: "/account/orders", label: "Orders", icon: ShoppingBag },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/profile", label: "Profile", icon: User },
] as const;

const linkClass =
  "inline-flex items-center gap-2 border-2 border-line bg-paper px-4 py-2.5 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-smoke no-underline shadow-press transition-colors hover:bg-paper-2 hover:text-ink motion-reduce:transition-none";
const activeLinkClass = "bg-signal text-ink hover:bg-signal hover:text-ink";

export function AccountLayout() {
  return (
    <div className={`${MAXW} flex flex-col gap-6 px-6 py-12`}>
      <div className="flex flex-col gap-3">
        <p className="cr-mono text-smoke">// my account</p>
        <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
          Account
        </h1>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Account sections">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={linkClass}
            activeProps={{ className: activeLinkClass }}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
