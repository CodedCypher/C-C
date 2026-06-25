import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { toNum } from '../common/money';
import {
  deriveSlug,
  fieldError,
  type StructuredBody,
} from '../common/structured-error';
import {
  projectLineSelect,
  resolveParts,
  summarize,
  webStock,
} from '../storefront/kit-projection';
import { CreateProjectKitDto } from './dto/create-project-kit.dto';
import { UpdateProjectKitDto } from './dto/update-project-kit.dto';

// ─── Response shapes (the frontend parses these via zod) ──────────────────────

export interface ProjectKitRow {
  id: string; // the BUILT variant id — stable kit identifier
  title: string;
  slug: string;
  sku: string;
  primaryImage: string | null;
  productStatus: string;
  kitPrice: number; // assembled price stored on the variant
  partsTotal: number; // live Σ of in-stock parts
  partCount: number;
  inStockCount: number;
  allInStock: boolean;
  published: boolean;
  position: number;
}

export interface ProjectKitPart {
  stockItemId: string;
  variantId: string;
  sku: string;
  name: string;
  uom: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  available: number;
  availability: string;
  canAdd: boolean;
}

export interface ProjectKitDetail extends Omit<ProjectKitRow, never> {
  description: string | null;
  parts: ProjectKitPart[];
}

// Detail-line select: projectLineSelect + the StockItem id/uom + line position
// the editor needs to pre-fill the parts picker.
const kitLineSelect = {
  quantity: true,
  unit: true,
  stockItem: {
    select: {
      id: true,
      kind: true,
      unitOfMeasure: true,
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

type KitDetailLine = Prisma.BomLineGetPayload<{ select: typeof kitLineSelect }>;

/** KIT-<SLUG>: the auto-derived sku for a kit's BUILT variant (matches seed). */
function kitSku(slug: string): string {
  return `KIT-${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
}

@Injectable()
export class ProjectKitsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List (drafts + published) ───────────────────────────────────────────────
  async list(): Promise<ProjectKitRow[]> {
    const variants = await this.prisma.variant.findMany({
      where: { isProjectKit: true, deletedAt: null },
      orderBy: [{ kitPosition: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        sku: true,
        price: true,
        kitPublished: true,
        kitPosition: true,
        product: {
          select: {
            title: true,
            slug: true,
            status: true,
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
      const parts = resolveParts(v.boms[0]?.lines ?? []);
      const { partCount, inStockCount, estimatedTotal } = summarize(parts);
      return {
        id: v.id,
        title: v.product.title,
        slug: v.product.slug,
        sku: v.sku,
        primaryImage: v.product.images[0]?.url ?? null,
        productStatus: v.product.status,
        kitPrice: toNum(v.price),
        partsTotal: estimatedTotal,
        partCount,
        inStockCount,
        allInStock: partCount > 0 && inStockCount === partCount,
        published: v.kitPublished,
        position: v.kitPosition,
      };
    });
  }

  // ── Detail (for the edit form) ───────────────────────────────────────────────
  async detail(id: string): Promise<ProjectKitDetail> {
    const v = await this.prisma.variant.findFirst({
      where: { id, isProjectKit: true, deletedAt: null },
      select: {
        id: true,
        sku: true,
        price: true,
        kitPublished: true,
        kitPosition: true,
        product: {
          select: {
            title: true,
            slug: true,
            status: true,
            description: true,
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
          select: { lines: { select: kitLineSelect } },
        },
      },
    });
    if (!v) throw new NotFoundException('Project kit not found');

    const parts = this.projectKitParts(v.boms[0]?.lines ?? []);
    const inStock = parts.filter((p) => p.canAdd);
    return {
      id: v.id,
      title: v.product.title,
      slug: v.product.slug,
      sku: v.sku,
      description: v.product.description,
      primaryImage: v.product.images[0]?.url ?? null,
      productStatus: v.product.status,
      kitPrice: toNum(v.price),
      partsTotal: inStock.reduce((s, p) => s + p.lineTotal, 0),
      partCount: parts.length,
      inStockCount: inStock.length,
      allInStock: parts.length > 0 && inStock.length === parts.length,
      published: v.kitPublished,
      position: v.kitPosition,
      parts,
    };
  }

  // Build the editor parts list (carries stockItemId/uom the picker needs).
  private projectKitParts(lines: KitDetailLine[]): ProjectKitPart[] {
    const parts: ProjectKitPart[] = [];
    for (const l of lines) {
      const si = l.stockItem;
      const variant = si.variant;
      if (si.kind !== 'VARIANT' || !variant) continue;
      const quantity = toNum(l.quantity);
      const unitPrice = toNum(variant.price);
      const { available, availability } = webStock(si);
      const purchasable =
        variant.isActive &&
        variant.deletedAt === null &&
        variant.product.status === 'ACTIVE';
      parts.push({
        stockItemId: si.id,
        variantId: variant.id,
        sku: variant.sku,
        name: variant.title ?? variant.product.title,
        uom: si.unitOfMeasure,
        image: variant.product.images[0]?.url ?? null,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        available,
        availability,
        canAdd: purchasable && available >= quantity,
      });
    }
    return parts;
  }

  // ── Create ───────────────────────────────────────────────────────────────────
  async create(dto: CreateProjectKitDto): Promise<{ id: string }> {
    const slug = (dto.slug?.trim() || deriveSlug(dto.title)).trim();
    if (!slug) {
      throw new ConflictException(
        fieldError(
          'title',
          'Could not derive a slug from the title.',
          409,
          'Conflict',
        ),
      );
    }
    const sku = kitSku(slug);

    return this.prisma.$transaction(async (tx) => {
      // Slug + sku uniqueness.
      const slugClash = await tx.product.findFirst({
        where: { slug },
        select: { id: true },
      });
      if (slugClash) {
        throw new ConflictException(
          fieldError(
            'slug',
            `Slug "${slug}" is already in use`,
            409,
            'Conflict',
          ),
        );
      }
      const skuClash = await tx.variant.findFirst({
        where: { sku },
        select: { id: true },
      });
      if (skuClash) {
        throw new ConflictException(
          fieldError(
            'slug',
            `A kit with sku "${sku}" already exists`,
            409,
            'Conflict',
          ),
        );
      }

      await this.assertVariantParts(tx, dto.parts);

      const kitsCategory = await tx.category.upsert({
        where: { slug: 'kits' },
        update: {},
        create: { name: 'Kits', slug: 'kits' },
        select: { id: true },
      });

      const position = await tx.variant.count({
        where: { isProjectKit: true },
      });

      const product = await tx.product.create({
        data: {
          title: dto.title,
          slug,
          description: dto.description ?? null,
          status: 'ACTIVE',
          categoryLinks: { create: [{ categoryId: kitsCategory.id }] },
        },
        select: { id: true },
      });

      const variant = await tx.variant.create({
        data: {
          productId: product.id,
          sku,
          price: dto.kitPrice,
          sourcingType: 'BUILT',
          isActive: true,
          isProjectKit: true,
          kitPublished: false, // draft until explicitly published
          kitPosition: position,
        },
        select: { id: true },
      });

      if (dto.imageUrl) {
        await tx.productImage.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            url: dto.imageUrl,
            alt: dto.title,
            isPrimary: true,
          },
        });
      }

      // The kit's own StockItem (assembled to order — never web-stocked).
      await tx.stockItem.create({
        data: { kind: 'VARIANT', variantId: variant.id, unitOfMeasure: 'EACH' },
      });

      await tx.billOfMaterials.create({
        data: {
          variantId: variant.id,
          version: 1,
          isActive: true,
          lines: {
            create: dto.parts.map((p) => ({
              stockItemId: p.stockItemId,
              quantity: p.quantity,
              unit: 'EACH' as const,
            })),
          },
        },
      });

      return { id: variant.id };
    });
  }

  // ── Update (marketing + price + position + parts) ─────────────────────────────
  async update(id: string, dto: UpdateProjectKitDto): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const kit = await tx.variant.findFirst({
        where: { id, isProjectKit: true, deletedAt: null },
        select: { id: true, productId: true },
      });
      if (!kit) throw new NotFoundException('Project kit not found');

      // Product-level marketing fields.
      const productData: Prisma.ProductUpdateInput = {};
      if (dto.title !== undefined) productData.title = dto.title;
      if (dto.description !== undefined)
        productData.description = dto.description;
      if (Object.keys(productData).length > 0) {
        await tx.product.update({
          where: { id: kit.productId },
          data: productData,
        });
      }

      // Hero image: string = set/replace primary, null = clear, undefined = leave.
      if (dto.imageUrl !== undefined) {
        await tx.productImage.deleteMany({
          where: { productId: kit.productId, isPrimary: true },
        });
        if (dto.imageUrl) {
          await tx.productImage.create({
            data: {
              productId: kit.productId,
              variantId: kit.id,
              url: dto.imageUrl,
              alt: dto.title ?? undefined,
              isPrimary: true,
            },
          });
        }
      }

      // Variant-level fields.
      const variantData: Prisma.VariantUpdateInput = {};
      if (dto.kitPrice !== undefined) variantData.price = dto.kitPrice;
      if (dto.position !== undefined) variantData.kitPosition = dto.position;
      if (Object.keys(variantData).length > 0) {
        await tx.variant.update({ where: { id: kit.id }, data: variantData });
      }

      // Parts → replace the active BOM's lines in place.
      if (dto.parts !== undefined) {
        await this.assertVariantParts(tx, dto.parts);
        const activeBom = await tx.billOfMaterials.findFirst({
          where: { variantId: kit.id, isActive: true },
          select: { id: true },
        });
        const lineData = dto.parts.map((p) => ({
          stockItemId: p.stockItemId,
          quantity: p.quantity,
          unit: 'EACH' as const,
        }));
        if (activeBom) {
          await tx.bomLine.deleteMany({ where: { bomId: activeBom.id } });
          await tx.bomLine.createMany({
            data: lineData.map((l) => ({ ...l, bomId: activeBom.id })),
          });
        } else {
          await tx.billOfMaterials.create({
            data: {
              variantId: kit.id,
              version: 1,
              isActive: true,
              lines: { create: lineData },
            },
          });
        }
      }

      return { id: kit.id };
    });
  }

  // ── Publish toggle ────────────────────────────────────────────────────────────
  async setPublished(
    id: string,
    published: boolean,
  ): Promise<{ id: string; published: boolean }> {
    const kit = await this.prisma.variant.findFirst({
      where: { id, isProjectKit: true, deletedAt: null },
      select: {
        id: true,
        boms: {
          where: { isActive: true },
          take: 1,
          select: { lines: { select: projectLineSelect } },
        },
      },
    });
    if (!kit) throw new NotFoundException('Project kit not found');

    if (published) {
      const parts = resolveParts(kit.boms[0]?.lines ?? []);
      if (parts.length === 0) {
        const body: StructuredBody = {
          statusCode: 400,
          error: 'ValidationError',
          fieldErrors: {},
          formErrors: ['Add at least one catalog part before publishing.'],
        };
        throw new BadRequestException(body);
      }
    }

    await this.prisma.variant.update({
      where: { id: kit.id },
      data: { kitPublished: published },
    });
    return { id: kit.id, published };
  }

  // ── Reorder (up/down, renumbers all kits to keep positions dense) ─────────────
  async move(
    id: string,
    direction: 'up' | 'down',
  ): Promise<{ id: string; moved: boolean }> {
    const kits = await this.prisma.variant.findMany({
      where: { isProjectKit: true, deletedAt: null },
      orderBy: [{ kitPosition: 'asc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    const idx = kits.findIndex((k) => k.id === id);
    if (idx === -1) throw new NotFoundException('Project kit not found');

    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= kits.length) return { id, moved: false };

    const order = kits.map((k) => k.id);
    [order[idx], order[swap]] = [order[swap], order[idx]];
    await this.prisma.$transaction(
      order.map((kid, i) =>
        this.prisma.variant.update({
          where: { id: kid },
          data: { kitPosition: i },
        }),
      ),
    );
    return { id, moved: true };
  }

  // ── Remove from kits (unflag; product survives) ───────────────────────────────
  async remove(id: string): Promise<{ id: string }> {
    const kit = await this.prisma.variant.findFirst({
      where: { id, isProjectKit: true, deletedAt: null },
      select: { id: true },
    });
    if (!kit) throw new NotFoundException('Project kit not found');
    await this.prisma.variant.update({
      where: { id: kit.id },
      data: { isProjectKit: false, kitPublished: false },
    });
    return { id: kit.id };
  }

  // Validate every part references an existing, sellable catalog variant.
  private async assertVariantParts(
    tx: Prisma.TransactionClient,
    parts: { stockItemId: string }[],
  ): Promise<void> {
    const ids = parts.map((p) => p.stockItemId);
    const found = await tx.stockItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, kind: true },
    });
    const byId = new Map(found.map((s) => [s.id, s]));
    const fieldErrors: Record<string, string[]> = {};
    parts.forEach((p, i) => {
      const si = byId.get(p.stockItemId);
      if (!si) {
        fieldErrors[`parts.${i}.stockItemId`] = ['Part not found.'];
      } else if (si.kind !== 'VARIANT') {
        fieldErrors[`parts.${i}.stockItemId`] = [
          'Only catalog products can be kit parts (no raw materials).',
        ];
      }
    });
    if (Object.keys(fieldErrors).length > 0) {
      const body: StructuredBody = {
        statusCode: 400,
        error: 'ValidationError',
        fieldErrors,
        formErrors: [],
      };
      throw new BadRequestException(body);
    }
  }
}
