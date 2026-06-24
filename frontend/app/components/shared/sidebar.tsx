import {
  ArrowLeftRight,
  Blocks,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  FolderTree,
  Layers,
  LayoutDashboard,
  ListTree,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Tag,
  Tags,
  Truck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks admin — Sidebar
 *
 * The carbon "second neutral layer". A dark-adapted wordmark + ADMIN tag at
 * top, then grouped nav. Built routes are real RR `NavLink`s (active = signal
 * left marker + paper text + subtle signal bg). Placeholder routes render
 * visibly disabled (dimmer, not-allowed cursor, a tiny SOON tag) and never
 * navigate. When `collapsed`, items become icon-only with the label as a
 * title/tooltip and group headers hide. `onNavigate` fires on a real item
 * click so the mobile drawer can close itself.
 */

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Placeholder routes are visibly disabled and do not navigate. */
  soon?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Commerce",
    items: [
      { label: "Orders", to: "/orders", icon: ShoppingCart },
      { label: "Payment Methods", to: "/payment-methods", icon: CreditCard },
      { label: "Returns", to: "/returns", icon: RotateCcw, soon: true },
      { label: "Discounts", to: "/discounts", icon: Tag, soon: true },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { label: "Products", to: "/products", icon: Package },
      { label: "Project Kits", to: "/project-kits", icon: Blocks },
      { label: "Inventory", to: "/inventory", icon: Boxes },
      { label: "Raw Materials", to: "/raw-materials", icon: Layers },
      { label: "Categories", to: "/categories", icon: FolderTree, soon: true },
      { label: "Brands", to: "/brands", icon: Tags, soon: true },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Warehouses", to: "/warehouses", icon: Warehouse },
      { label: "Branches", to: "/branches", icon: Building2 },
      { label: "Transfers", to: "/transfers", icon: ArrowLeftRight },
      { label: "Suppliers", to: "/suppliers", icon: Truck, soon: true },
      {
        label: "Purchase Orders",
        to: "/purchase-orders",
        icon: ClipboardList,
        soon: true,
      },
    ],
  },
  {
    heading: "Manufacturing",
    items: [
      { label: "BOMs", to: "/boms", icon: ListTree },
      { label: "Build Orders", to: "/build-orders", icon: Wrench },
    ],
  },
  {
    heading: "People",
    items: [{ label: "Team", to: "/team", icon: Users, soon: true }],
  },
  {
    heading: "System",
    items: [
      { label: "Settings", to: "/settings", icon: Settings, soon: true },
    ],
  },
];

function Wordmark({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center"
        title="circuit.rocks · Admin"
      >
        <span className="inline-block size-[10px] border-2 border-paper bg-signal" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-baseline gap-0.5">
        <span className="font-sans text-[19px] font-bold tracking-[-0.02em] text-paper">
          circuit
        </span>
        <span className="inline-block size-[7px] -translate-y-px border-2 border-paper bg-signal" />
        <span className="font-mono text-[17px] font-bold text-paper">
          rocks
        </span>
      </span>
      <span className="border-2 border-dark-meta px-1.5 py-0.5 font-mono text-[0.625rem] font-bold uppercase leading-none tracking-[0.12em] text-dark-meta">
        Admin
      </span>
    </div>
  );
}

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  // Shared layout for both real links and disabled placeholders.
  const rowBase = cn(
    "group relative flex items-center gap-3 px-3 py-2 font-sans text-[0.875rem] font-medium outline-none transition-colors duration-150 motion-reduce:transition-none",
    collapsed && "justify-center px-0",
  );

  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? `${item.label} (coming soon)` : "Coming soon"}
        className={cn(
          rowBase,
          "cursor-not-allowed text-dark-meta/60 select-none",
        )}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <span className="cr-micro border border-dark-meta/40 px-1 py-px text-[0.5625rem] leading-none text-dark-meta/70">
              Soon
            </span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === "/" }}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={rowBase}
      activeProps={{
        className: cn(
          "bg-signal/15 text-paper",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal",
        ),
      }}
      inactiveProps={{
        className: cn(
          "text-dark-meta hover:bg-paper/5 hover:text-paper",
          "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal",
        ),
      }}
    >
      {({ isActive }) => (
        <>
          {/* Signal active marker (left edge) */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-0 h-full w-[3px] bg-signal",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon
            className={cn(
              "size-[18px] shrink-0",
              isActive ? "text-signal" : "",
            )}
            aria-hidden="true"
          />
          {!collapsed ? (
            <span className="flex-1 truncate">{item.label}</span>
          ) : null}
        </>
      )}
    </Link>
  );
}

export function Sidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-carbon text-paper">
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b-2 border-line/60",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Wordmark collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav
        aria-label="Admin"
        className="flex-1 overflow-y-auto overflow-x-hidden py-3"
      >
        {NAV.map((group) => (
          <div key={group.heading} className="mb-3 px-2 last:mb-0">
            {!collapsed ? (
              <p className="cr-micro px-3 pb-1.5 pt-2 text-dark-meta">
                {group.heading}
              </p>
            ) : (
              <div
                aria-hidden="true"
                className="mx-3 my-2 border-t border-line/50"
              />
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer tag */}
      {!collapsed ? (
        <div className="shrink-0 border-t-2 border-line/60 px-4 py-3">
          <p className="cr-micro text-dark-meta/70">circuit.rocks · console</p>
        </div>
      ) : null}
    </div>
  );
}
