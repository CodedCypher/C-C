import { Prisma } from '../generated/prisma/client';
import { toNum } from '../common/money';
import { computeStockState, type StockState } from '../common/stock';

/* ------------------------------------------------------------------ *
 * Shared project-kit projection
 *
 * A "project kit" is a BUILT variant whose active BOM lines resolve to
 * purchasable catalog parts. The storefront (public) and the admin
 * project-kits module both turn BOM lines into a priced, stock-checked
 * parts list — this module is the single source of that logic so the two
 * never drift. Pure functions only (no Prisma client, no `this`).
 * ------------------------------------------------------------------ */

// A BOM line resolved to its component: the line's own StockItem already carries
// the web-warehouse stock AND (for kind=VARIANT) the sellable variant + product.
export const projectLineSelect = {
  quantity: true,
  unit: true,
  stockItem: {
    select: {
      kind: true,
      reorderPoint: true,
      warehouseStock: {
        where: { warehouse: { isDefaultWeb: true } },
        select: { onHand: true, reserved: true, reorderPoint: true },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          title: true,
          price: true,
          isActive: true,
          deletedAt: true,
          product: {
            select: {
              slug: true,
              status: true,
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
} satisfies Prisma.BomLineSelect;

export type ProjectLine = Prisma.BomLineGetPayload<{
  select: typeof projectLineSelect;
}>;

// Shape needed to derive web-warehouse availability for a StockItem.
export type WebStockInput = {
  reorderPoint: Prisma.Decimal | null;
  warehouseStock: {
    onHand: Prisma.Decimal;
    reserved: Prisma.Decimal;
    reorderPoint: Prisma.Decimal | null;
  }[];
} | null;

/**
 * A single resolved component of a project kit: a purchasable variant pulled
 * from the kit's BOM, priced + stock-checked for the WEB warehouse.
 */
export interface ProjectPart {
  variantId: string;
  productSlug: string;
  sku: string;
  title: string;
  image: string | null;
  unit: string;
  requiredQty: number;
  unitPrice: number;
  lineTotal: number;
  available: number;
  availability: StockState;
  purchasable: boolean;
  canAdd: boolean;
}

/** available = onHand − reserved at the web warehouse, plus its IN_STOCK/LOW/OUT state. */
export function webStock(stockItem: WebStockInput): {
  available: number;
  availability: StockState;
} {
  const wsi = stockItem?.warehouseStock[0];
  const available = toNum(wsi?.onHand) - toNum(wsi?.reserved);
  const rp = wsi?.reorderPoint ?? stockItem?.reorderPoint ?? null;
  return {
    available,
    availability: computeStockState(available, rp === null ? null : toNum(rp)),
  };
}

/**
 * Turn a kit's active-BOM lines into purchasable, stock-checked parts. Only
 * VARIANT-kind lines on sellable ACTIVE products become parts (raw-material
 * lines aren't individually purchasable, so they're skipped).
 */
export function resolveParts(lines: ProjectLine[]): ProjectPart[] {
  const parts: ProjectPart[] = [];
  for (const line of lines) {
    const si = line.stockItem;
    const variant = si.variant;
    if (si.kind !== 'VARIANT' || !variant) continue; // not individually sellable

    const requiredQty = toNum(line.quantity);
    const unitPrice = toNum(variant.price);
    const { available, availability } = webStock(si);
    const purchasable =
      variant.isActive &&
      variant.deletedAt === null &&
      variant.product.status === 'ACTIVE';

    parts.push({
      variantId: variant.id,
      productSlug: variant.product.slug,
      sku: variant.sku,
      title: variant.title ?? variant.product.title,
      image: variant.product.images[0]?.url ?? null,
      unit: line.unit,
      requiredQty,
      unitPrice,
      lineTotal: unitPrice * requiredQty,
      available,
      availability,
      purchasable,
      canAdd: purchasable && available >= requiredQty,
    });
  }
  return parts;
}

export function summarize(parts: ProjectPart[]): {
  partCount: number;
  inStockCount: number;
  estimatedTotal: number;
} {
  const inStock = parts.filter((p) => p.canAdd);
  return {
    partCount: parts.length,
    inStockCount: inStock.length,
    estimatedTotal: inStock.reduce((sum, p) => sum + p.lineTotal, 0),
  };
}
