import type { ReactNode } from "react";
import { LogOut, Menu, Search } from "lucide-react";
import { useLocation } from "@tanstack/react-router";

import { Badge } from "~/components/ui/badge";
import { useLogout } from "~/features/auth";

/**
 * circuit.rocks admin — Topbar
 *
 * Sticky bar across the content column: bg-paper, 2px bottom border. Left holds
 * a mobile-only hamburger (calls `onMenuClick`) and a breadcrumb derived from
 * the current path ("Console / Orders"). Right holds a (non-functional)
 * brutalist search input, a LIVE env badge, a user chip, and account controls
 * (a logout button by default, overridable via `userSlot`). One row, responsive.
 */

/** Title-case a path segment ("build-orders" → "Build Orders"). */
function labelize(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Build a breadcrumb trail from the pathname. "/" → ["Console"],
 * "/orders" → ["Console", "Orders"], "/orders/123" →
 * ["Console", "Orders", "123"].
 */
function useBreadcrumb(): string[] {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  return ["Console", ...parts.map(labelize)];
}

/** Default account control: a logout button driven by `useLogout()`. */
function LogoutButton() {
  const logout = useLogout();
  return (
    <button
      type="button"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      aria-label="Log out"
      className="cr-press inline-flex size-9 shrink-0 items-center justify-center border-2 border-line bg-paper text-ink shadow-press outline-none hover:bg-signal focus-visible:ring-2 focus-visible:ring-ink active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden="true" />
    </button>
  );
}

export function Topbar({
  onMenuClick,
  userSlot,
}: {
  onMenuClick?: () => void;
  /** Right-aligned user/account controls (e.g. a logout form). */
  userSlot?: ReactNode;
}) {
  const crumbs = useBreadcrumb();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b-2 border-line bg-paper px-4 sm:px-6">
      {/* Mobile hamburger (< md) */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="cr-press inline-flex size-10 shrink-0 items-center justify-center border-2 border-line bg-paper text-ink shadow-press outline-none hover:bg-signal focus-visible:ring-2 focus-visible:ring-ink active:shadow-none md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 overflow-hidden font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em]">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li
                key={`${c}-${i}`}
                className="flex shrink-0 items-center gap-1.5 last:min-w-0 last:shrink"
              >
                {i > 0 ? (
                  <span aria-hidden="true" className="text-dark-meta">
                    /
                  </span>
                ) : null}
                <span className={last ? "truncate text-ink" : "text-smoke"}>
                  {c}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Search (decorative placeholder) */}
      <div className="relative hidden items-center md:flex">
        <Search
          className="pointer-events-none absolute left-2.5 size-4 text-smoke"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search…"
          aria-label="Search"
          className="h-10 w-40 border-2 border-line bg-paper pl-8 pr-3 font-mono text-[0.8125rem] text-ink placeholder:text-dark-meta outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink lg:w-56"
        />
      </div>

      {/* Env badge */}
      <Badge variant="signal" size="sm" className="hidden sm:inline-flex">
        Live
      </Badge>

      {/* User chip + account controls */}
      <div className="flex shrink-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-9 items-center justify-center border-2 border-line bg-carbon font-mono text-[0.8125rem] font-bold text-paper"
        >
          CR
        </span>
        <span className="hidden font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink lg:inline">
          Admin
        </span>
        {userSlot ?? <LogoutButton />}
      </div>
    </header>
  );
}
