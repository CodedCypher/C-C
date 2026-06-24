import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";

import { isStaff, type User } from "~/features/auth";

/**
 * circuit.rocks — NavHeader account control (desktop).
 *
 * Three states off the shared `me` query:
 *   - loading  → fixed-width skeleton (no layout shift while `me` resolves)
 *   - signed out → "Log in" link + "Sign up" signal button
 *   - signed in  → initials chip + name, click opens a brutalist menu
 *     (identity, Dashboard for staff, Log out)
 *
 * The signed-in menu is a click-triggered popover: light-dismiss on outside
 * pointerdown, Escape returns focus to the trigger, and it stays mounted so the
 * open/close transition can run (kept inert + non-interactive while closed).
 */

/** Display name: full name when present, else the email. */
export function accountName(user: User): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email;
}

/** Up to two uppercase initials, falling back to the email's first letter. */
export function accountInitials(user: User): string {
  const first = user.firstName?.trim().charAt(0) ?? "";
  const last = user.lastName?.trim().charAt(0) ?? "";
  const letters = `${first}${last}`.trim();
  return (letters || user.email.charAt(0) || "?").toUpperCase();
}

export function NavAccount({
  user,
  isLoading,
  onLogout,
  loggingOut,
  next,
}: {
  user: User | null;
  isLoading: boolean;
  onLogout: () => void;
  loggingOut: boolean;
  next?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const searchParam = next ? { next } : undefined;

  // Loading — stable footprint so the bar doesn't jump when `me` resolves.
  if (isLoading) {
    return (
      <div
        aria-hidden
        className="h-10 w-[108px] animate-pulse border-2 border-line/30 bg-paper-2"
      />
    );
  }

  // Signed out — explicit log in / sign up.
  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          to="/login"
          search={searchParam}
          className="inline-flex h-10 items-center border-2 border-transparent px-2.5 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline transition-colors hover:border-line motion-reduce:transition-none"
        >
          Log in
        </Link>
        <Link
          to="/register"
          search={searchParam}
          className="cr-press inline-flex h-10 items-center border-2 border-line bg-signal px-3.5 font-sans text-[0.8125rem] font-bold uppercase leading-none tracking-[0.04em] text-ink no-underline shadow-brutal hover:shadow-press active:shadow-none"
        >
          Sign up
        </Link>
      </div>
    );
  }

  // Signed in — initials chip + name, menu on click.
  const staff = isStaff(user.role);
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="cr-press inline-flex h-10 items-center gap-2 border-2 border-line bg-paper py-1 pl-1 pr-2.5 text-ink shadow-brutal hover:shadow-press active:shadow-none"
      >
        <span className="grid size-7 shrink-0 place-items-center border-2 border-line bg-signal font-mono text-[0.75rem] font-bold leading-none text-ink">
          {accountInitials(user)}
        </span>
        <span className="max-w-[140px] truncate font-mono text-[0.8125rem] font-bold leading-none text-ink">
          {accountName(user)}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-label="Account"
        inert={!open}
        className={`absolute right-0 top-full z-[60] mt-3 min-w-[248px] origin-top-right border-2 border-line bg-paper shadow-brutal-lg transition duration-150 ease-out motion-reduce:transition-none ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <div className="border-b-2 border-line px-4 py-3">
          <p className="truncate font-sans text-[0.9375rem] font-bold leading-tight text-ink">
            {accountName(user)}
          </p>
          <p className="mt-0.5 truncate font-mono text-[0.75rem] text-smoke">
            {user.email}
          </p>
        </div>
        <div className="flex flex-col p-1.5">
          <Link
            to="/account/orders"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-2 font-sans text-[0.875rem] font-medium text-ink no-underline transition-colors hover:bg-signal motion-reduce:transition-none"
          >
            <UserRound aria-hidden className="size-4 shrink-0" />
            My account
          </Link>
          {staff && (
            <Link
              to="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 font-sans text-[0.875rem] font-medium text-ink no-underline transition-colors hover:bg-signal motion-reduce:transition-none"
            >
              <LayoutDashboard aria-hidden className="size-4 shrink-0" />
              Dashboard
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            disabled={loggingOut}
            className="flex items-center gap-2.5 px-2.5 py-2 text-left font-sans text-[0.875rem] font-medium text-ink transition-colors hover:bg-signal disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            <LogOut aria-hidden className="size-4 shrink-0" />
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
