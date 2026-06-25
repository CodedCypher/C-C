import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, type SavedBuildLine } from '../generated/prisma/client';
import { toNum } from '../common/money';
import { computeStockState, type StockState } from '../common/stock';
import {
  projectLineSelect,
  webStock as deriveWebStock,
  resolveParts as resolveKitParts,
  summarize as summarizeKitParts,
  type ProjectLine,
  type ProjectPart,
  type WebStockInput,
} from './kit-projection';
import { fieldError } from '../common/structured-error';
import { AddLineDto, CheckoutDto, UpdateLineDto } from './dto/storefront.dto';
import {
  BuildMatcherService,
  type CatalogEntry,
  type MatchedLine,
} from './build-matcher.service';

/* ------------------------------------------------------------------ *
 * Public response shapes
 * ------------------------------------------------------------------ */

export interface ProductSummary {
  slug: string;
  title: string;
  brand: string | null;
  priceMin: number;
  priceMax: number;
  primaryImage: string | null;
  availability: StockState;
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  brand: string | null;
  priceMin: number;
  priceMax: number;
  images: { url: string; alt: string | null; isPrimary: boolean }[];
  optionTypes: {
    id: string;
    name: string;
    values: { id: string; value: string }[];
  }[];
  variants: {
    id: string;
    sku: string;
    title: string | null;
    price: number;
    compareAtPrice: number | null;
    optionValueIds: string[];
    availability: StockState;
  }[];
  specGroups: {
    group: string | null;
    items: { key: string; value: string; unit: string | null }[];
  }[];
}

export interface CartLineDto {
  variantId: string;
  sku: string;
  name: string;
  productSlug: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CartDto {
  currency: string;
  lines: CartLineDto[];
  subtotal: number;
  count: number;
}

export interface CheckoutResult {
  orderNumber: string;
  grandTotal: number;
}

/** A single cascading-dropdown option (PH address ref data). */
export interface RefOption {
  code: string;
  name: string;
}

/** A branch shown as a pickup option at checkout. */
export interface BranchSummary {
  id: string;
  name: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
}

/** An admin-managed payment method shown at checkout. */
export interface PaymentMethodSummary {
  id: string;
  name: string;
  instructions: string | null;
  qrImageUrl: string | null;
}

// ProjectPart now lives in ./kit-projection (shared with the admin project-kits
// module). Re-exported here so existing storefront consumers keep importing it.
export type { ProjectPart };

export interface ProjectSummary {
  slug: string;
  variantId: string;
  title: string;
  primaryImage: string | null;
  partCount: number;
  inStockCount: number;
  estimatedTotal: number; // Σ lineTotal of in-stock parts
  allInStock: boolean;
}

export interface ProjectDetail {
  slug: string;
  variantId: string;
  title: string;
  description: string | null;
  primaryImage: string | null;
  assembledPrice: number; // the BUILT kit variant's own price ("buy assembled")
  parts: ProjectPart[];
  partCount: number;
  inStockCount: number;
  estimatedTotal: number;
}

/* ------------------------------------------------------------------ *
 * Saved builds — inspiration resolved to catalog parts (NOT a BOM kit)
 * ------------------------------------------------------------------ */

/** Per-line outcome after matching + a fresh stock check. */
export type BuildLineStatus =
  | 'MATCHED' // confident, in stock
  | 'SUBSTITUTED' // matched a close-but-not-exact part (see note)
  | 'LOW_CONFIDENCE' // matched, but the matcher wasn't sure
  | 'OUT_OF_STOCK' // matched a real part that can't be added right now
  | 'UNMATCHED'; // no catalog equivalent

/** A matched build line: a resolved ProjectPart + matcher metadata. */
/** A resolved alternative the shopper can swap to (lighter than a full part). */
export interface BuildAlternative {
  variantId: string;
  productSlug: string;
  sku: string;
  title: string;
  image: string | null;
  unitPrice: number;
  available: number;
  availability: ProjectPart['availability'];
  canAdd: boolean;
}

export interface BuildPart extends ProjectPart {
  lineId: string; // stable per-line key (frontend keys swaps by this, not variantId)
  rawLabel: string; // what the maker's source called it
  confidence: number; // 0..1 matcher certainty
  note: string | null; // substitution / clarification note
  status: BuildLineStatus;
  // When the active variant is an auto-swap away from the matcher's primary pick
  // (primary was out of stock), what the maker originally asked for.
  swappedFrom: { rawLabel: string; title: string } | null;
  alternatives: BuildAlternative[]; // other in-stock-first equivalents (revert / other options)
}

/** A line the matcher could not map to any catalog variant. */
export interface BuildUnmatchedLine {
  rawLabel: string;
  requiredQty: number;
  note: string | null; // matcher's suggestion ("no close match; try …")
  status: 'UNMATCHED';
}

/** Light "My builds" list row — no per-line re-resolution. */
export interface BuildSummary {
  id: string;
  slug: string; // == id (shareable)
  title: string;
  sourceType: 'TEXT' | 'URL' | 'IMAGE';
  partCount: number;
  createdAt: string;
}

export interface BuildDetail {
  id: string;
  slug: string; // == id (opaque, shareable)
  title: string;
  sourceType: 'TEXT' | 'URL' | 'IMAGE';
  parts: BuildPart[]; // matched, resolvable lines
  unmatched: BuildUnmatchedLine[]; // gaps the maker should see
  partCount: number; // matched + unmatched
  inStockCount: number;
  estimatedTotal: number; // Σ lineTotal of in-stock matched parts
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * Prisma selection fragments
 * ------------------------------------------------------------------ */

// Per-variant stock at the default-web warehouse (single fulfilment WH for WEB).
const variantStockSelect = {
  reorderPoint: true,
  warehouseStock: {
    where: { warehouse: { isDefaultWeb: true } },
    select: { onHand: true, reserved: true, reorderPoint: true },
  },
} satisfies Prisma.StockItemSelect;

// Variant + web stock needed to resolve one saved-build line into a part.
const buildVariantSelect = {
  id: true,
  sku: true,
  title: true,
  price: true,
  isActive: true,
  deletedAt: true,
  product: {
    select: {
      slug: true,
      title: true,
      status: true,
      images: {
        orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
        take: 1,
        select: { url: true },
      },
    },
  },
  stockItem: { select: variantStockSelect },
} satisfies Prisma.VariantSelect;

type BuildVariantRow = Prisma.VariantGetPayload<{
  select: typeof buildVariantSelect;
}>;
type SavedBuildLineRow = SavedBuildLine;

// Cart + lines + the variant/product fields needed to render a cart row.
const cartLineInclude = {
  lines: {
    orderBy: { variantId: 'asc' },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          title: true,
          product: {
            select: {
              slug: true,
              title: true,
              images: {
                orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithLines = Prisma.CartGetPayload<{ include: typeof cartLineInclude }>;

// projectLineSelect / ProjectLine / WebStockInput moved to ./kit-projection
// (shared with the admin project-kits module). See imports at top of file.

/** The two inspiration doors that converge on the same resolve pipeline. */
export type ResolveBuildInput =
  | { kind: 'text'; text: string }
  | {
      kind: 'image';
      data: string;
      mimeType: string;
      filename: string;
      /** Root-relative URL of the persisted photo, when stored (build-chat). */
      imageUrl?: string;
    };

/** Door-specific "we found nothing" 400, mapped onto the matching input field. */
function emptyMatchError(input: ResolveBuildInput): BadRequestException {
  const [field, hint] =
    input.kind === 'image'
      ? ([
          'image',
          "Couldn't read any parts from that photo — try a clearer shot, or paste the list as text.",
        ] as const)
      : ([
          'text',
          "Couldn't find any parts in that text — try a clearer parts list.",
        ] as const);
  return new BadRequestException(fieldError(field, hint, 400, 'BadRequest'));
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: BuildMatcherService,
  ) {}

  /** available = onHand − reserved at the web warehouse, plus its IN_STOCK/LOW/OUT state. */
  private webStock(stockItem: WebStockInput): {
    available: number;
    availability: StockState;
  } {
    return deriveWebStock(stockItem);
  }

  /** Stock state only (back-compat for product/PDP callers). */
  private variantAvailability(stockItem: WebStockInput): StockState {
    return this.webStock(stockItem).availability;
  }

  // ── GET /storefront/products ───────────────────────────────────────────────
  /** A small list of ACTIVE products for the home page (most recent first). */
  async featured(limit = 8): Promise<ProductSummary[]> {
    const take = Math.min(Math.max(limit, 1), 24);
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        slug: true,
        title: true,
        brand: { select: { name: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          take: 1,
          select: { url: true },
        },
        variants: {
          where: { isActive: true, deletedAt: null },
          select: { price: true, stockItem: { select: variantStockSelect } },
        },
      },
    });

    return products.map((p) => {
      const prices = p.variants.map((v) => toNum(v.price));
      const states = p.variants.map((v) =>
        this.variantAvailability(v.stockItem),
      );
      return {
        slug: p.slug,
        title: p.title,
        brand: p.brand?.name ?? null,
        priceMin: prices.length ? Math.min(...prices) : 0,
        priceMax: prices.length ? Math.max(...prices) : 0,
        primaryImage: p.images[0]?.url ?? null,
        availability: this.rollupAvailability(states),
      };
    });
  }

  /** Best state across variants: IN_STOCK > LOW > OUT. */
  private rollupAvailability(states: StockState[]): StockState {
    if (states.includes('IN_STOCK')) return 'IN_STOCK';
    if (states.includes('LOW')) return 'LOW';
    return 'OUT';
  }

  // ── GET /storefront/products/:slug ───────────────────────────────────────────
  async productDetail(slug: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        brand: { select: { name: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          select: { url: true, alt: true, isPrimary: true },
        },
        optionTypes: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            values: {
              orderBy: { position: 'asc' },
              select: { id: true, value: true },
            },
          },
        },
        specs: {
          orderBy: { position: 'asc' },
          select: { group: true, key: true, value: true, unit: true },
        },
        variants: {
          where: { isActive: true, deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            sku: true,
            title: true,
            price: true,
            compareAtPrice: true,
            optionValues: { select: { optionValueId: true } },
            stockItem: { select: variantStockSelect },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        fieldError('slug', 'Product not found', 404, 'NotFound'),
      );
    }

    const variants = product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      title: v.title,
      price: toNum(v.price),
      compareAtPrice:
        v.compareAtPrice === null ? null : toNum(v.compareAtPrice),
      optionValueIds: v.optionValues.map((o) => o.optionValueId),
      availability: this.variantAvailability(v.stockItem),
    }));

    const prices = variants.map((v) => v.price);

    // Group specs by their `group` (preserving first-seen order).
    const groupMap = new Map<
      string | null,
      ProductDetail['specGroups'][number]
    >();
    for (const s of product.specs) {
      const key = s.group ?? null;
      let bucket = groupMap.get(key);
      if (!bucket) {
        bucket = { group: key, items: [] };
        groupMap.set(key, bucket);
      }
      bucket.items.push({ key: s.key, value: s.value, unit: s.unit });
    }

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      brand: product.brand?.name ?? null,
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      images: product.images,
      optionTypes: product.optionTypes,
      variants,
      specGroups: [...groupMap.values()],
    };
  }

  /* ---------------------------------------------------------------- *
   * Projects — resolve a BUILT variant's BOM into a buyable parts list
   * ---------------------------------------------------------------- */

  /**
   * Turn a kit's active-BOM lines into purchasable, stock-checked parts. Only
   * VARIANT-kind lines on sellable ACTIVE products become parts (raw-material
   * lines aren't individually purchasable, so they're skipped).
   */
  private resolveParts(lines: ProjectLine[]): ProjectPart[] {
    return resolveKitParts(lines);
  }

  private summarize(parts: ProjectPart[]) {
    return summarizeKitParts(parts);
  }

  // ── GET /storefront/projects ─────────────────────────────────────────────────
  /** Curated buildable kits = ACTIVE-product BUILT variants with an active BOM. */
  async listProjects(): Promise<ProjectSummary[]> {
    const variants = await this.prisma.variant.findMany({
      where: {
        sourcingType: 'BUILT',
        isActive: true,
        deletedAt: null,
        isProjectKit: true,
        kitPublished: true,
        product: { status: 'ACTIVE', deletedAt: null },
        boms: { some: { isActive: true } },
      },
      orderBy: [{ kitPosition: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        product: {
          select: {
            slug: true,
            title: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
              take: 1,
              select: { url: true },
            },
          },
        },
        boms: {
          where: { isActive: true },
          take: 1,
          select: { lines: { select: projectLineSelect } },
        },
      },
    });

    return variants.map((v) => {
      const parts = this.resolveParts(v.boms[0]?.lines ?? []);
      const { partCount, inStockCount, estimatedTotal } = this.summarize(parts);
      return {
        slug: v.product.slug,
        variantId: v.id,
        title: v.product.title,
        primaryImage: v.product.images[0]?.url ?? null,
        partCount,
        inStockCount,
        estimatedTotal,
        allInStock: partCount > 0 && inStockCount === partCount,
      };
    });
  }

  // ── GET /storefront/projects/:slug ───────────────────────────────────────────
  async projectDetail(slug: string): Promise<ProjectDetail> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      select: {
        slug: true,
        title: true,
        description: true,
        images: {
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          take: 1,
          select: { url: true },
        },
        variants: {
          where: {
            sourcingType: 'BUILT',
            isActive: true,
            deletedAt: null,
            isProjectKit: true,
            kitPublished: true,
            boms: { some: { isActive: true } },
          },
          take: 1,
          select: {
            id: true,
            price: true,
            boms: {
              where: { isActive: true },
              take: 1,
              select: { lines: { select: projectLineSelect } },
            },
          },
        },
      },
    });

    const kitVariant = product?.variants[0];
    if (!product || !kitVariant) {
      throw new NotFoundException(
        fieldError('slug', 'Project not found', 404, 'NotFound'),
      );
    }

    const parts = this.resolveParts(kitVariant.boms[0]?.lines ?? []);
    const { partCount, inStockCount, estimatedTotal } = this.summarize(parts);
    return {
      slug: product.slug,
      variantId: kitVariant.id,
      title: product.title,
      description: product.description,
      primaryImage: product.images[0]?.url ?? null,
      assembledPrice: toNum(kitVariant.price),
      parts,
      partCount,
      inStockCount,
      estimatedTotal,
    };
  }

  /* ---------------------------------------------------------------- *
   * Builds — resolve free-text inspiration into a saved, shareable cart
   * ---------------------------------------------------------------- */

  /** All sellable web variants, compacted as the matcher's match universe. */
  private async buildCatalog(): Promise<CatalogEntry[]> {
    const variants = await this.prisma.variant.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        product: { status: 'ACTIVE', deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        sku: true,
        title: true,
        price: true,
        product: { select: { title: true, brand: { select: { name: true } } } },
        stockItem: { select: variantStockSelect },
      },
    });
    return variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.title ?? v.product.title,
      brand: v.product.brand?.name ?? null,
      price: toNum(v.price),
      // Stock-awareness lets the matcher prefer in-stock primaries + rank swaps.
      availability: this.webStock(v.stockItem).availability,
    }));
  }

  /** Fetch matched variants once, keyed by id, with web-warehouse stock. */
  private async webVariantMap(ids: string[]) {
    if (ids.length === 0) return new Map<string, BuildVariantRow>();
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: ids } },
      select: buildVariantSelect,
    });
    return new Map<string, BuildVariantRow>(variants.map((v) => [v.id, v]));
  }

  /** One saved line + its resolved variant → a stock-checked, status-tagged part. */
  private toBuildPart(v: BuildVariantRow, line: SavedBuildLineRow): BuildPart {
    const requiredQty = line.quantity;
    const unitPrice = toNum(v.price);
    const { available, availability } = this.webStock(v.stockItem);
    const purchasable =
      v.isActive && v.deletedAt === null && v.product.status === 'ACTIVE';
    const canAdd = purchasable && available >= requiredQty;
    const status: BuildLineStatus = !purchasable
      ? 'UNMATCHED'
      : !canAdd
        ? 'OUT_OF_STOCK'
        : line.confidence < 0.6
          ? 'LOW_CONFIDENCE'
          : line.note
            ? 'SUBSTITUTED'
            : 'MATCHED';
    return {
      variantId: v.id,
      productSlug: v.product.slug,
      sku: v.sku,
      title: v.title ?? v.product.title,
      image: v.product.images[0]?.url ?? null,
      unit: 'pc',
      requiredQty,
      unitPrice,
      lineTotal: unitPrice * requiredQty,
      available,
      availability,
      purchasable,
      canAdd,
      lineId: line.id,
      rawLabel: line.rawLabel,
      confidence: line.confidence,
      note: line.note,
      status,
      swappedFrom: null,
      alternatives: [],
    };
  }

  /** Resolve one variant into a swap candidate (lighter than a full part). */
  private toAlternative(
    v: BuildVariantRow,
    requiredQty: number,
  ): BuildAlternative {
    const { available, availability } = this.webStock(v.stockItem);
    const purchasable =
      v.isActive && v.deletedAt === null && v.product.status === 'ACTIVE';
    return {
      variantId: v.id,
      productSlug: v.product.slug,
      sku: v.sku,
      title: v.title ?? v.product.title,
      image: v.product.images[0]?.url ?? null,
      unitPrice: toNum(v.price),
      available,
      availability,
      canAdd: purchasable && available >= requiredQty,
    };
  }

  /**
   * Resolve a saved line into a part, AUTO-SWAPPING to the best in-stock
   * alternative when the matcher's primary pick can't be added. Returns null
   * only when neither the primary nor any alternative exists in the catalog.
   */
  private resolveBuildLine(
    line: SavedBuildLineRow,
    vmap: Map<string, BuildVariantRow>,
  ): BuildPart | null {
    const addable = (v: BuildVariantRow) => {
      const { available } = this.webStock(v.stockItem);
      const purchasable =
        v.isActive && v.deletedAt === null && v.product.status === 'ACTIVE';
      return purchasable && available >= line.quantity;
    };

    const primary = line.variantId ? vmap.get(line.variantId) : undefined;
    const altRows = line.alternativeVariantIds
      .map((id) => vmap.get(id))
      .filter((v): v is BuildVariantRow => v !== undefined);

    // Primary if addable; else first in-stock alternative; else fall back to the
    // primary (shown OOS) or any alternative so the gap is still visible.
    const chosen =
      primary && addable(primary)
        ? primary
        : (altRows.find(addable) ?? primary ?? altRows[0]);
    if (!chosen) return null; // nothing in catalog → unmatched

    const part = this.toBuildPart(chosen, line);
    const swapped = !primary || chosen.id !== primary.id;
    if (swapped) {
      part.status = 'SUBSTITUTED';
      part.swappedFrom = {
        rawLabel: line.rawLabel,
        title: primary
          ? (primary.title ?? primary.product.title)
          : 'no exact catalog match',
      };
    }

    // Every other candidate (incl. the original OOS pick) becomes a swap option.
    const seen = new Set([chosen.id]);
    const others: BuildVariantRow[] = [];
    for (const v of [primary, ...altRows]) {
      if (v && !seen.has(v.id)) {
        seen.add(v.id);
        others.push(v);
      }
    }
    part.alternatives = others.map((v) => this.toAlternative(v, line.quantity));
    return part;
  }

  /** Build the public detail payload from a saved build + its lines (fresh stock). */
  private async assembleBuild(
    build: {
      id: string;
      title: string;
      sourceType: 'TEXT' | 'URL' | 'IMAGE';
      createdAt: Date;
    },
    lines: SavedBuildLineRow[],
  ): Promise<BuildDetail> {
    const ordered = [...lines].sort((a, b) => a.position - b.position);
    // Fetch primaries AND every alternative in one query (swaps need live stock).
    const ids = [
      ...new Set(
        ordered.flatMap((l) => [
          ...(l.variantId ? [l.variantId] : []),
          ...l.alternativeVariantIds,
        ]),
      ),
    ];
    const vmap = await this.webVariantMap(ids);

    const parts: BuildPart[] = [];
    const unmatched: BuildUnmatchedLine[] = [];
    for (const line of ordered) {
      const part = this.resolveBuildLine(line, vmap);
      if (part) {
        parts.push(part);
      } else {
        unmatched.push({
          rawLabel: line.rawLabel,
          requiredQty: line.quantity,
          note: line.note,
          status: 'UNMATCHED',
        });
      }
    }

    const inStock = parts.filter((p) => p.canAdd);
    return {
      id: build.id,
      slug: build.id,
      title: build.title,
      sourceType: build.sourceType,
      parts,
      unmatched,
      partCount: parts.length + unmatched.length,
      inStockCount: inStock.length,
      estimatedTotal: inStock.reduce((sum, p) => sum + p.lineTotal, 0),
      createdAt: build.createdAt.toISOString(),
    };
  }

  /** A short human title derived from the first confidently matched part. */
  private deriveTitle(
    matched: { rawLabel: string; matchedVariantId: string | null }[],
    catalog: CatalogEntry[],
  ): string {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const first = matched.find((m) => m.matchedVariantId);
    const name = first?.matchedVariantId
      ? (byId.get(first.matchedVariantId)?.name ?? null)
      : (matched[0]?.rawLabel ?? null);
    const n = matched.length;
    if (!name) return `Custom build (${n} parts)`;
    return n > 1 ? `Build: ${name} + ${n - 1} more` : `Build: ${name}`;
  }

  /**
   * POST — resolve pasted inspiration into a persisted, shareable build. Mints a
   * fresh `cr_cart` token when the guest has none (returned to set as a cookie)
   * so the build and the guest's cart share an owner.
   */
  async resolveBuild(
    token: string | undefined,
    input: ResolveBuildInput,
    userId?: string,
  ): Promise<{ build: BuildDetail; token: string }> {
    const catalog = await this.buildCatalog();
    const { matched, sourceType, sourceRef } = await this.matchInput(
      input,
      catalog,
    );

    if (matched.length === 0) {
      throw emptyMatchError(input);
    }

    const sessionToken = token ?? randomUUID();
    const created = await this.prisma.savedBuild.create({
      data: {
        title: this.deriveTitle(matched, catalog),
        sourceType,
        sourceRef,
        sessionToken,
        userId: userId ?? null,
        lines: {
          create: matched.map((m, i) => ({
            variantId: m.matchedVariantId,
            rawLabel: m.rawLabel,
            quantity: m.qty,
            confidence: m.confidence,
            note: m.note,
            position: i,
            alternativeVariantIds: m.alternativeVariantIds,
          })),
        },
      },
      include: { lines: true },
    });

    const build = await this.assembleBuild(created, created.lines);
    return { build, token: sessionToken };
  }

  /**
   * Run the right matcher for the inspiration door (text / photo) and report
   * which source it was so the SavedBuild records its provenance. Both converge
   * on the same `MatchedLine[]` that the rest of resolveBuild persists and
   * re-resolves identically.
   */
  private async matchInput(
    input: ResolveBuildInput,
    catalog: CatalogEntry[],
  ): Promise<{
    matched: MatchedLine[];
    sourceType: 'TEXT' | 'IMAGE';
    sourceRef: string;
  }> {
    if (input.kind === 'image') {
      const matched = await this.matcher.matchImage(
        { data: input.data, mimeType: input.mimeType },
        catalog,
      );
      return {
        matched,
        sourceType: 'IMAGE',
        sourceRef: input.filename.slice(0, 200),
      };
    }
    const matched = await this.matcher.match(input.text, catalog);
    return {
      matched,
      sourceType: 'TEXT',
      sourceRef: input.text.slice(0, 4000),
    };
  }

  /** GET — re-resolve a saved build by id (fresh stock/price every view). */
  async getBuild(id: string): Promise<BuildDetail> {
    const build = await this.prisma.savedBuild.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!build) {
      throw new NotFoundException(
        fieldError('slug', 'Build not found', 404, 'NotFound'),
      );
    }
    return this.assembleBuild(build, build.lines);
  }

  /**
   * "My builds" — list the builds owned by the caller. Signed-in users own by
   * `userId`; guests own by `sessionToken` (the `cr_cart` cookie). Returns light
   * summaries (no per-line re-resolution) for the list view.
   */
  async listBuilds(
    token: string | undefined,
    userId?: string,
  ): Promise<BuildSummary[]> {
    const where = this.buildOwnerWhere(token, userId);
    if (!where) return [];
    const rows = await this.prisma.savedBuild.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        sourceType: true,
        createdAt: true,
        _count: { select: { lines: true } },
      },
    });
    return rows.map((b) => ({
      id: b.id,
      slug: b.id,
      title: b.title,
      sourceType: b.sourceType,
      partCount: b._count.lines,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  /** Delete a build the caller owns. 404 when missing or not theirs. */
  async deleteBuild(
    id: string,
    token: string | undefined,
    userId?: string,
  ): Promise<{ id: string }> {
    const owner = this.buildOwnerWhere(token, userId);
    if (!owner) throw this.buildNotFound();
    const build = await this.prisma.savedBuild.findFirst({
      where: { id, ...owner },
      select: { id: true },
    });
    if (!build) throw this.buildNotFound();
    await this.prisma.savedBuild.delete({ where: { id: build.id } });
    return { id: build.id };
  }

  /** Ownership filter: prefer the signed-in user, else the guest cookie token. */
  private buildOwnerWhere(
    token: string | undefined,
    userId?: string,
  ): { userId: string } | { sessionToken: string } | null {
    if (userId) return { userId };
    if (token) return { sessionToken: token };
    return null;
  }

  private buildNotFound(): NotFoundException {
    return new NotFoundException(
      fieldError('slug', 'Build not found', 404, 'NotFound'),
    );
  }

  /* ---------------------------------------------------------------- *
   * Cart
   * ---------------------------------------------------------------- */

  private async activeCart(token: string | undefined) {
    if (!token) return null;
    return this.prisma.cart.findFirst({
      where: { sessionToken: token, status: 'ACTIVE' },
      include: cartLineInclude,
    });
  }

  private toCartDto(cart: CartWithLines | null): CartDto {
    if (!cart) {
      return { currency: 'PHP', lines: [], subtotal: 0, count: 0 };
    }
    const lines: CartLineDto[] = cart.lines.map((l) => {
      const unitPrice = toNum(l.unitPriceSnapshot);
      return {
        variantId: l.variantId,
        sku: l.variant.sku,
        name: l.variant.title ?? l.variant.product.title,
        productSlug: l.variant.product.slug,
        image: l.variant.product.images[0]?.url ?? null,
        unitPrice,
        quantity: l.quantity,
        lineTotal: unitPrice * l.quantity,
      };
    });
    return {
      currency: cart.currency,
      lines,
      subtotal: lines.reduce((sum, l) => sum + l.lineTotal, 0),
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
    };
  }

  /** GET — current cart contents (empty cart when there's no token/cart). */
  async getCart(token: string | undefined): Promise<CartDto> {
    return this.toCartDto(await this.activeCart(token));
  }

  /**
   * Add a variant to the cart. Returns the updated cart plus the session token
   * to write back as a cookie (a fresh token is minted when no active cart yet).
   */
  async addLine(
    token: string | undefined,
    dto: AddLineDto,
  ): Promise<{ cart: CartDto; token: string }> {
    const variant = await this.prisma.variant.findFirst({
      where: {
        id: dto.variantId,
        isActive: true,
        deletedAt: null,
        product: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, price: true },
    });
    if (!variant) {
      throw new BadRequestException(
        fieldError(
          'variantId',
          'This item is not available',
          400,
          'BadRequest',
        ),
      );
    }

    let cart = await this.activeCart(token);
    let sessionToken = token ?? '';
    if (!cart) {
      sessionToken = randomUUID();
      cart = await this.prisma.cart.create({
        data: { sessionToken, status: 'ACTIVE', currency: 'PHP' },
        include: cartLineInclude,
      });
    }

    const existing = cart.lines.find((l) => l.variantId === dto.variantId);
    const nextQty = Math.min((existing?.quantity ?? 0) + dto.quantity, 999);

    await this.prisma.cartLine.upsert({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
      create: {
        cartId: cart.id,
        variantId: dto.variantId,
        quantity: nextQty,
        unitPriceSnapshot: variant.price,
      },
      update: { quantity: nextQty },
    });

    const fresh = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: cartLineInclude,
    });
    return { cart: this.toCartDto(fresh), token: sessionToken };
  }

  async updateLine(
    token: string | undefined,
    variantId: string,
    dto: UpdateLineDto,
  ): Promise<CartDto> {
    const cart = await this.activeCart(token);
    if (!cart) {
      throw new BadRequestException(
        fieldError('cart', 'No active cart', 400, 'BadRequest'),
      );
    }
    if (dto.quantity === 0) {
      await this.prisma.cartLine.deleteMany({
        where: { cartId: cart.id, variantId },
      });
    } else {
      await this.prisma.cartLine.updateMany({
        where: { cartId: cart.id, variantId },
        data: { quantity: dto.quantity },
      });
    }
    return this.toCartDto(
      await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: cartLineInclude,
      }),
    );
  }

  async removeLine(
    token: string | undefined,
    variantId: string,
  ): Promise<CartDto> {
    const cart = await this.activeCart(token);
    if (!cart) {
      throw new BadRequestException(
        fieldError('cart', 'No active cart', 400, 'BadRequest'),
      );
    }
    await this.prisma.cartLine.deleteMany({
      where: { cartId: cart.id, variantId },
    });
    return this.toCartDto(
      await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: cartLineInclude,
      }),
    );
  }

  /* ---------------------------------------------------------------- *
   * Address reference lookups (cascading checkout dropdowns)
   * ---------------------------------------------------------------- */

  async regions(): Promise<RefOption[]> {
    const rows = await this.prisma.refRegion.findMany({
      orderBy: { regDesc: 'asc' },
      select: { regCode: true, regDesc: true },
    });
    return rows.map((r) => ({ code: r.regCode, name: r.regDesc }));
  }

  async provinces(regCode: string): Promise<RefOption[]> {
    const rows = await this.prisma.refProvince.findMany({
      where: { regCode },
      orderBy: { provDesc: 'asc' },
      select: { provCode: true, provDesc: true },
    });
    return rows.map((r) => ({ code: r.provCode, name: r.provDesc }));
  }

  async cityMunicipalities(provCode: string): Promise<RefOption[]> {
    const rows = await this.prisma.refCityMun.findMany({
      where: { provCode },
      orderBy: { citymunDesc: 'asc' },
      select: { citymunCode: true, citymunDesc: true },
    });
    return rows.map((r) => ({ code: r.citymunCode, name: r.citymunDesc }));
  }

  async barangays(citymunCode: string): Promise<RefOption[]> {
    const rows = await this.prisma.refBarangay.findMany({
      where: { citymunCode },
      orderBy: { brgyDesc: 'asc' },
      select: { brgyCode: true, brgyDesc: true },
    });
    return rows.map((r) => ({ code: r.brgyCode, name: r.brgyDesc }));
  }

  /* ---------------------------------------------------------------- *
   * Pickup branches + payment methods (public)
   * ---------------------------------------------------------------- */

  async branches(): Promise<BranchSummary[]> {
    return this.prisma.branch.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        line1: true,
        line2: true,
        city: true,
        region: true,
        phone: true,
      },
    });
  }

  async paymentMethods(): Promise<PaymentMethodSummary[]> {
    return this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, instructions: true, qrImageUrl: true },
    });
  }

  /* ---------------------------------------------------------------- *
   * Checkout
   * ---------------------------------------------------------------- */

  /**
   * Create a PENDING web Order + PENDING manual Payment (proof + reference) from
   * the active cart in one transaction, then mark the cart CONVERTED. No
   * inventory reservation/decrement — admin fulfilment posts stock later, and
   * verifies the uploaded proof. Totals = line totals (no tax/shipping/discount).
   *
   * `proofImageUrl` is the stored upload URL (the controller has already
   * persisted the multipart file). `userId` is set for signed-in shoppers.
   */
  async checkout(
    token: string | undefined,
    dto: CheckoutDto,
    proofImageUrl: string,
    userId?: string,
  ): Promise<CheckoutResult> {
    const cart = await this.activeCart(token);
    if (!cart || cart.lines.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'BadRequest',
        fieldErrors: {},
        formErrors: ['Your cart is empty.'],
      });
    }

    const isPickup = dto.fulfillmentType === 'PICKUP';

    // Validate the chosen branch (pickup) + payment method against live data.
    let branchId: string | null = null;
    if (isPickup) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException(
          fieldError(
            'branchId',
            'Select a valid pickup branch',
            400,
            'ValidationError',
          ),
        );
      }
      branchId = branch.id;
    }

    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: dto.paymentMethodId, isActive: true },
      select: { id: true },
    });
    if (!method) {
      throw new BadRequestException(
        fieldError(
          'paymentMethodId',
          'Select a valid payment method',
          400,
          'ValidationError',
        ),
      );
    }

    const lines = cart.lines.map((l) => {
      const unitPrice = toNum(l.unitPriceSnapshot);
      const lineTotal = unitPrice * l.quantity;
      return {
        variantId: l.variantId,
        sku: l.variant.sku,
        title: l.variant.title ?? l.variant.product.title,
        quantity: l.quantity,
        unitPrice,
        lineTotal,
      };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          channel: 'WEB',
          fulfillmentType: dto.fulfillmentType,
          email: dto.email,
          status: 'PENDING',
          currency: cart.currency,
          userId: userId ?? null,
          branchId,
          // Contact is kept for both pickup + delivery.
          shipName: dto.shipName,
          shipPhone: dto.shipPhone,
          // Delivery address snapshot (null for pickup).
          shipLine1: isPickup ? null : (dto.shipLine1 ?? null),
          shipLine2: isPickup ? null : (dto.shipLine2 ?? null),
          shipBarangay: isPickup ? null : (dto.shipBarangay ?? null),
          shipCity: isPickup ? null : (dto.shipCity ?? null),
          shipProvince: isPickup ? null : (dto.shipProvince ?? null),
          shipRegion: isPickup ? null : (dto.shipRegion ?? null),
          shipPostal: isPickup ? null : (dto.shipPostal ?? null),
          shipCountry: isPickup ? null : (dto.shipCountry ?? 'Philippines'),
          subtotal,
          shippingTotal: 0,
          grandTotal: subtotal,
          placedAt: new Date(),
          lines: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              sku: l.sku,
              title: l.title,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
          payments: {
            create: {
              provider: 'manual',
              status: 'PENDING',
              amount: subtotal,
              currency: cart.currency,
              paymentMethodId: dto.paymentMethodId,
              reference: dto.reference,
              proofImageUrl,
            },
          },
        },
        select: { orderNumber: true, grandTotal: true },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CONVERTED' },
      });

      return created;
    });

    return {
      orderNumber: order.orderNumber,
      grandTotal: toNum(order.grandTotal),
    };
  }
}
