import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { isStaff, useAuth, useLogout } from "~/features/auth";

import { NavAccount, accountInitials, accountName } from "./nav-account";

/**
 * circuit.rocks — NavHeader
 * Wordmark left · category labels (mono uppercase) with hover mega-menu · search ·
 * login · cart-count. Sticky, 2px bottom border. Mobile collapses to a Sheet drawer.
 */
function Wordmark() {
  return (
    <a
      href="/"
      className="inline-flex shrink-0 items-baseline gap-0.5 no-underline"
    >
      <span className="font-sans text-[20px] font-bold tracking-[-0.02em] text-ink">
        circuit
      </span>
      <span className="inline-block size-[7px] -translate-y-px border-2 border-line bg-signal" />
      <span className="font-mono text-[18px] font-bold text-ink">rocks</span>
    </a>
  );
}

const iconBtn =
  "inline-flex size-10 items-center justify-center border-2 border-transparent text-ink";

export function NavHeader({
  categories = ["Boards", "Sensors", "Kits", "Components", "Tools", "Learn"],
  megaMenu = {},
  cartCount = 0,
  sticky = true,
  onCartClick,
}: {
  categories?: string[];
  megaMenu?: Record<string, string[]>;
  cartCount?: number;
  sticky?: boolean;
  onCartClick?: () => void;
}) {
  const { user, isLoading } = useAuth();
  const logout = useLogout();
  // Full path + search of the current page, so login/register can bounce back here.
  const next = useRouterState({ select: (s) => s.location.href });
  const authSearch = next ? { next } : undefined;

  return (
    <header
      className={`${sticky ? "sticky" : "static"} top-0 z-50 border-b-2 border-line bg-paper`}
    >
      <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-6 py-3.5">
        <Wordmark />

        <Link
          to="/projects"
          className="hidden shrink-0 items-center border-2 border-line bg-signal px-3 py-1.5 font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink no-underline shadow-press min-[881px]:inline-flex"
        >
          Build a project
        </Link>

        <Link
          to="/build"
          className="hidden shrink-0 items-center font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-smoke no-underline hover:text-ink min-[881px]:inline-flex"
        >
          Assistant
        </Link>

        <Link
          to="/my-builds"
          className="hidden shrink-0 items-center font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-smoke no-underline hover:text-ink min-[881px]:inline-flex"
        >
          My builds
        </Link>

        {/* Categories (desktop) */}
        <nav className="flex flex-1 items-center gap-[22px] max-[880px]:hidden">
          {categories.map((c) => {
            const items = megaMenu[c];
            return (
              <div key={c} className="group/cat relative">
                <button className="relative cursor-pointer border-none bg-transparent py-1.5 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink">
                  {c}
                  {items && (
                    <span className="absolute -bottom-0.5 left-0 hidden h-[3px] w-full bg-signal group-hover/cat:block" />
                  )}
                </button>
                {items && (
                  <div className="absolute left-0 top-full z-[60] mt-3 hidden min-w-[240px] grid-cols-1 gap-0.5 border-2 border-line bg-paper p-3.5 shadow-brutal-lg group-hover/cat:grid">
                    {items.map((item) => (
                      <a
                        key={item}
                        href="#"
                        className="block px-2 py-1.5 font-sans text-[0.9375rem] text-ink no-underline hover:bg-signal"
                      >
                        {item}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 max-[880px]:flex-1 max-[880px]:justify-end">
          <button aria-label="Search" className={iconBtn}>
            <Search className="size-5" />
          </button>

          {/* Account / auth (desktop) */}
          <div className="flex items-center gap-2 max-[880px]:hidden">
            <NavAccount
              user={user}
              isLoading={isLoading}
              onLogout={() => logout.mutate()}
              loggingOut={logout.isPending}
              next={next}
            />
            <span className="h-6 w-0.5 shrink-0 bg-line" aria-hidden />
          </div>

          <button
            type="button"
            aria-label="Cart"
            onClick={onCartClick}
            className={`${iconBtn} relative`}
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center border-2 border-line bg-signal px-1 font-mono text-[11px] font-bold leading-none text-ink">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile drawer */}
          <Sheet>
            <SheetTrigger
              aria-label="Menu"
              className={`${iconBtn} hidden min-[881px]:hidden max-[880px]:inline-flex`}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>// menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col px-6">
                <Link
                  to="/projects"
                  className="border-b border-line py-3 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline"
                >
                  Build a project
                </Link>
                <Link
                  to="/build"
                  className="border-b border-line py-3 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline"
                >
                  Build assistant
                </Link>
                <Link
                  to="/my-builds"
                  className="border-b border-line py-3 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline"
                >
                  My builds
                </Link>
                {categories.map((c) => (
                  <a
                    key={c}
                    href="#"
                    className="border-b border-line py-3 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline"
                  >
                    {c}
                  </a>
                ))}
              </nav>

              {/* Account / auth (mobile) */}
              <div className="mt-5 border-t-2 border-line px-6 pb-6 pt-5">
                {isLoading ? (
                  <div className="h-11 w-full animate-pulse border-2 border-line/30 bg-paper-2" />
                ) : user ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center border-2 border-line bg-signal font-mono text-[0.8125rem] font-bold leading-none text-ink">
                        {accountInitials(user)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-sans text-[0.9375rem] font-bold leading-tight text-ink">
                          {accountName(user)}
                        </p>
                        <p className="truncate font-mono text-[0.75rem] text-smoke">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {isStaff(user.role) && (
                        <Button asChild variant="secondary" className="w-full">
                          <Link to="/dashboard">Dashboard</Link>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => logout.mutate()}
                        disabled={logout.isPending}
                      >
                        {logout.isPending ? "Signing out…" : "Log out"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <Button asChild variant="secondary" className="w-full">
                      <Link to="/login" search={authSearch}>
                        Log in
                      </Link>
                    </Button>
                    <Button asChild variant="primary" className="w-full">
                      <Link to="/register" search={authSearch}>
                        Sign up
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
