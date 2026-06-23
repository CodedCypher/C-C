/**
 * circuit.rocks — storefront feature barrel.
 *
 * The public marketing site. STATIC — no api/ or hooks/ (no backend calls).
 * The router imports the page from here; the presentational components and the
 * verbatim demo data are re-exported for any other consumer.
 */

// Pages (consumed by the router)
export { HomePage } from "./pages/home-page";

// Presentational components
export { AnnouncementBar } from "./components/announcement-bar";
export { BrandTile } from "./components/brand-tile";
export { DateBlockCard } from "./components/date-block-card";
export { Footer } from "./components/footer";
export { ImgTile } from "./components/img-tile";
export { NavHeader } from "./components/nav-header";
export { ProductCard } from "./components/product-card";
export { SectionLabel } from "./components/section-label";
export { StatBlock } from "./components/stat-block";

// Static demo data
export {
  BRANDS,
  EVENTS,
  FEATURED,
  MEGA,
  MOVERS,
  PROPS,
  type Product,
} from "./data";
