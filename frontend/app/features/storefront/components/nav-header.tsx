import { Menu, Search, ShoppingCart, User } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

/**
 * circuit.rocks — NavHeader
 * Wordmark left · category labels (mono uppercase) with hover mega-menu · search ·
 * login · cart-count. Sticky, 2px bottom border. Mobile collapses to a Sheet drawer.
 */
function Wordmark() {
  return (
    <a
      href="#"
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
}: {
  categories?: string[];
  megaMenu?: Record<string, string[]>;
  cartCount?: number;
  sticky?: boolean;
}) {
  return (
    <header
      className={`${sticky ? "sticky" : "static"} top-0 z-50 border-b-2 border-line bg-paper`}
    >
      <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-6 py-3.5">
        <Wordmark />

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
          <button aria-label="Account" className={iconBtn}>
            <User className="size-5" />
          </button>
          <button aria-label="Cart" className={`${iconBtn} relative`}>
            <ShoppingCart className="size-5" />
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center border-2 border-line bg-signal px-1 font-mono text-[11px] font-bold leading-none text-ink">
              {cartCount}
            </span>
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
              <nav className="flex flex-col px-6 pb-6">
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
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
