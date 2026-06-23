/**
 * circuit.rocks — storefront feature: public marketing home page.
 *
 * Ported from the old SSR `routes/home.tsx` + `components/home/homepage.tsx`.
 * This is the public storefront: it is STATIC (no backend calls, no api/hooks).
 * All content comes from the verbatim demo `data.ts`. Presentational components
 * (nav, footer, product card, etc.) live in this feature's `components/`.
 *
 * In-page links are plain `<a href="#">` anchors (no route navigation), so no
 * router import is needed here.
 */

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

import { AnnouncementBar } from "../components/announcement-bar";
import { BrandTile } from "../components/brand-tile";
import { DateBlockCard } from "../components/date-block-card";
import { Footer } from "../components/footer";
import { NavHeader } from "../components/nav-header";
import { ProductCard } from "../components/product-card";
import { SectionLabel } from "../components/section-label";
import { StatBlock } from "../components/stat-block";
import { BRANDS, EVENTS, FEATURED, MEGA, MOVERS, PROPS } from "../data";

const MAXW = "mx-auto max-w-[1320px]";
const GRID4 =
  "grid grid-cols-4 gap-[18px] max-[1000px]:grid-cols-2 max-[520px]:grid-cols-1";

/* ---------- shared section heading ---------- */
function SectionHead({
  label,
  title,
  action,
}: {
  label: string;
  title?: string;
  action?: string;
}) {
  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <SectionLabel className={title ? "mb-2.5" : undefined}>
          {label}
        </SectionLabel>
        {title && (
          <h2 className="font-sans text-[2rem] font-bold uppercase tracking-[-0.01em]">
            {title}
          </h2>
        )}
      </div>
      {action && (
        <a
          href="#"
          className="border-b-[3px] border-signal pb-0.5 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline"
        >
          {action}
        </a>
      )}
    </div>
  );
}

/* ---------- Hero + stat row ---------- */
function Hero() {
  return (
    <section className="border-b-2 border-line bg-paper">
      <div
        className={`${MAXW} grid grid-cols-[1.15fr_0.85fr] items-center gap-12 px-6 pt-14 max-[1000px]:grid-cols-1`}
      >
        {/* Left */}
        <div>
          <SectionLabel className="mb-5">make.md</SectionLabel>
          <h1 className="font-sans text-[clamp(3rem,7vw,6rem)] font-bold uppercase leading-[0.92] tracking-[-0.03em]">
            Make
            <br />
            What's
            <br />
            Next.
          </h1>
          <p className="mt-6 max-w-[460px] text-[1.125rem] leading-[1.6] text-ink">
            Electronics parts, dev boards & maker kits — in Manila stock,
            shipped same-day. Sourced direct from Adafruit, DFRobot & Arduino.
          </p>
          <div className="mt-7 flex flex-wrap gap-3.5">
            <Button size="lg">BROWSE PARTS →</Button>
            <Button variant="secondary" size="lg">
              ARDUINO STARTER →
            </Button>
          </div>
          <div className="mt-8 border-t-2 border-line pt-4 font-mono text-xs uppercase tracking-[0.06em] text-smoke">
            Adafruit · DFRobot · Arduino · Raspberry Pi · SparkFun · Seeed ·
            Pololu
          </div>
        </div>
        {/* Right */}
        <div className="relative pb-6">
          <div className="border-2 border-line bg-paper shadow-brutal-lg">
            <img
              src="/products/rpi5.jpg"
              alt="Raspberry Pi 5"
              className="aspect-square w-full p-6 [mix-blend-mode:multiply] [object-fit:contain]"
            />
          </div>
          <span className="absolute -right-2.5 -top-3.5">
            <Badge variant="signal">// IN STOCK</Badge>
          </span>
        </div>
      </div>

      {/* Stat row */}
      <div className="mt-10 border-t-2 border-line">
        <div
          className={`${MAXW} grid grid-cols-3 gap-6 px-6 py-7 max-[720px]:grid-cols-1`}
        >
          <StatBlock value="2,394" caption="ITEMS IN MANILA" />
          <StatBlock value="10+ YRS" caption="POWERING PH MAKERS" />
          <StatBlock value="31K" caption="PACKAGES DELIVERED" accent />
        </div>
        <div className="border-t-2 border-line bg-paper-2">
          <div
            className={`${MAXW} px-6 py-3 font-mono text-[0.8125rem] uppercase tracking-[0.06em] text-ink`}
          >
            <span className="text-hazard">★★★★★</span> 4.8 (380+ reviews) · COD ·
            GCASH · MAYA · CUTOFF 4PM
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Featured rail ---------- */
function FeaturedRail() {
  return (
    <section className="border-b-2 border-line bg-paper">
      <div className={`${MAXW} px-6 py-16`}>
        <SectionHead label="featured.txt" action="VIEW ALL →" />
        <div className="grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-[18px] overflow-x-auto pb-2">
          {FEATURED.map((p) => (
            <ProductCard key={p.sku} {...p} image={`/products/${p.imageLabel}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Top movers ---------- */
function TopMovers() {
  return (
    <section className="border-b-2 border-line bg-paper-2">
      <div className={`${MAXW} px-6 py-16`}>
        <SectionHead
          label="updated daily"
          title="Top Movers This Week"
          action="VIEW ALL →"
        />
        <div className={GRID4}>
          {MOVERS.map((p) => (
            <ProductCard key={p.sku} {...p} image={`/products/${p.imageLabel}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Shop by brand ---------- */
function ShopByBrand() {
  return (
    <section className="border-b-2 border-line bg-paper">
      <div className={`${MAXW} px-6 py-16`}>
        <SectionHead
          label="in-stock today"
          title="Shop by Brand"
          action="ALL BRANDS →"
        />
        <div className={GRID4}>
          {BRANDS.map((b) => (
            <BrandTile key={b.brand} {...b} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Tutorial band (dark) ---------- */
function TutorialBand() {
  return (
    <section className="border-b-2 border-line bg-carbon">
      <div
        className={`${MAXW} grid grid-cols-[1fr_0.9fr] items-center gap-12 px-6 py-[72px] max-[1000px]:grid-cols-1`}
      >
        <div>
          <SectionLabel onDark accent className="mb-[18px]">
            learn.circuit.rocks · tutorial
          </SectionLabel>
          <h2 className="font-sans text-[clamp(2rem,3.5vw,2.75rem)] font-bold uppercase leading-[1.02] tracking-[-0.02em] text-paper">
            Control an External LED over Wi-Fi
          </h2>
          <p className="my-[18px] mb-[26px] max-w-[460px] text-[1.0625rem] leading-[1.6] text-dark-meta">
            ESP32 Mini Guide — wire an LED, flash the firmware, and toggle it
            from any browser on your network. Beginner-friendly, ~20 minutes.
          </p>
          <Button size="lg">READ TUTORIAL →</Button>
        </div>
        {/* Terminal snippet */}
        <div className="overflow-hidden border-2 border-paper bg-[#111] shadow-[6px_6px_0_var(--signal)]">
          <div className="flex items-center gap-2 border-b-2 border-paper px-3.5 py-2.5">
            <span className="size-[9px] border-2 border-paper bg-signal" />
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-dark-meta">
              esp32_led.ino
            </span>
          </div>
          <pre className="m-0 overflow-x-auto p-4 font-mono text-[0.8125rem] leading-[1.7] text-paper">
            <span className="text-dark-meta">{"// connect, then serve"}</span>
            {`
WiFi.begin(ssid, pass);
server.on(`}
            <span className="text-signal">"/on"</span>
            {`, [](){
  digitalWrite(LED, `}
            <span className="text-signal">HIGH</span>
            {`);
  server.send(200, `}
            <span className="text-signal">"text/plain"</span>
            {`, `}
            <span className="text-signal">"led:on"</span>
            {`);
});`}
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ---------- Events strip ---------- */
function EventsStrip() {
  return (
    <section className="border-b-2 border-line bg-paper">
      <div className={`${MAXW} px-6 py-16`}>
        <div className="mb-[22px] flex items-end justify-between">
          <SectionLabel>events.txt</SectionLabel>
          <a
            href="#"
            className="border-b-[3px] border-signal pb-0.5 font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-ink no-underline"
          >
            VIEW ALL →
          </a>
        </div>
        <div className={GRID4}>
          {EVENTS.map((e, i) => (
            <DateBlockCard key={i} {...e} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Value props ---------- */
function ValueProps() {
  return (
    <section className="border-b-2 border-line bg-paper-2">
      <div
        className={`${MAXW} grid grid-cols-3 gap-[18px] px-6 py-16 max-[720px]:grid-cols-1`}
      >
        {PROPS.map((p, i) => (
          <Card key={i} className="gap-3 p-6">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-smoke">
              {p.label}
            </span>
            <h3 className="font-sans text-xl font-semibold leading-tight">
              {p.title}
            </h3>
            <p className="text-[0.9375rem] leading-[1.6] text-ink">{p.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------- Brand statement (dark) ---------- */
function BrandStatement() {
  return (
    <section className="border-b-2 border-line bg-carbon">
      <div className={`${MAXW} px-6 py-24 text-center`}>
        <h2 className="font-sans text-[clamp(2.75rem,7vw,6rem)] font-bold uppercase leading-[0.95] tracking-[-0.03em] text-paper">
          Empower the <span className="text-signal">Maker.</span>
        </h2>
        <p className="mx-auto mb-8 mt-6 max-w-[620px] text-[1.125rem] leading-[1.6] text-dark-meta">
          Ideas made physical. The boards, sensors and kits that turn concepts
          into reality — stocked in Manila, sourced direct, for over a decade.
        </p>
        <div className="flex flex-wrap justify-center gap-3.5">
          <Button size="lg">BROWSE ALL 2,394 PARTS →</Button>
          <Button variant="secondary" size="lg" onDark>
            READ THE BUILD LOG →
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Composition ---------- */
export function HomePage() {
  return (
    <>
      <AnnouncementBar />
      <NavHeader cartCount={2} megaMenu={MEGA} />
      <Hero />
      <FeaturedRail />
      <TopMovers />
      <ShopByBrand />
      <TutorialBand />
      <EventsStrip />
      <ValueProps />
      <BrandStatement />
      <Footer />
    </>
  );
}
