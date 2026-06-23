import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * circuit.rocks admin — AdminLayout
 *
 * The app shell.
 *   • lg+   : full-height sticky Sidebar (expanded, collapsible to icon rail).
 *   • md–lg : Sidebar permanently collapsed to an icon rail.
 *   • < md  : Sidebar hidden; opened on demand as a Sheet drawer via the
 *             Topbar hamburger.
 * The shell is pinned to the viewport height: the Sidebar and Topbar stay
 * fixed while only <main> scrolls. (A page-level scroll with a `sticky`
 * sidebar breaks here because the shell's `overflow` ancestor becomes the
 * sticky scroll container — so we scroll the content region instead.)
 */
export function AdminLayout({
  children,
  userSlot,
}: {
  children: React.ReactNode;
  /** Right-aligned account controls passed through to the Topbar. */
  userSlot?: React.ReactNode;
}) {
  // Desktop (lg+) collapse toggle. Persisted only in memory.
  const [collapsed, setCollapsed] = React.useState(false);
  // Mobile (< md) drawer.
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-paper">
      {/* ── Desktop sidebar (md and up) ── */}
      <aside
        className={cn(
          "relative hidden h-full shrink-0 border-r-2 border-line md:flex md:flex-col",
          // md–lg: forced icon rail. lg+: width follows `collapsed`.
          "w-16",
          collapsed ? "lg:w-16" : "lg:w-60",
        )}
      >
        {/* md–lg always renders collapsed; lg+ follows state. */}
        <div className="hidden h-full md:block lg:hidden">
          <Sidebar collapsed />
        </div>
        <div className="hidden h-full lg:block">
          <Sidebar collapsed={collapsed} />
        </div>

        {/* Collapse toggle — lg+ only (the rail is fixed below lg). */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="absolute bottom-3 right-2 hidden size-8 items-center justify-center border-2 border-line/60 bg-carbon text-dark-meta outline-none transition-colors duration-150 hover:text-paper focus-visible:ring-2 focus-visible:ring-signal motion-reduce:transition-none lg:inline-flex"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* ── Mobile drawer (< md) ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[260px] border-r-2 bg-carbon p-0 sm:max-w-[260px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Content column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setDrawerOpen(true)} userSlot={userSlot} />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
