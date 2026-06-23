import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductStatus, Prisma } from '../generated/prisma/client';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
} from './dto/create-product.dto';
import { normalizePaging } from '../common/pagination';
import { toNum } from '../common/money';
import {
  StructuredBody,
  fieldError,
  deriveSlug,
} from '../common/structured-error';
import { WarehousesService, WarehouseRow } from '../warehouses/warehouses.service';

export interface ProductsResult {
  rows: {
    title: string;
    slug: string;
    brand: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    variantCount: number;
    priceMin: number;
    priceMax: number;
    totalOnHand: number;
    primaryImage: string | null;
  }[];
  total: number;
  page: number;
  take: number;
}

export interface CreateProductResult {
  id: string;
  slug: string;
  title: string;
  variantCount: number;
}

export interface BrandOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface FormOptions {
  brands: BrandOption[];
  categories: CategoryOption[];
  warehouses: WarehouseRow[];
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehousesService: WarehousesService,
  ) {}

  // ── GET /products ────────────────────────────────────────────────────────────
  async products(params: {
    status?: string;
    q?: string;
    page?: number;
    take?: number;
  }): Promise<ProductsResult> {
    const { page, take, skip } = normalizePaging(params);

    const where: Prisma.ProductWhereInput = {};
    if (params.status && params.status in ProductStatus) {
      where.status = params.status as ProductStatus;
    }
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { slug: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [total, productsRaw] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          title: true,
          slug: true,
          status: true,
          brand: { select: { name: true } },
          variants: {
            select: {
              price: true,
              stockItem: { select: { onHand: true } },
            },
          },
          images: {
            where: { isPrimary: true },
            orderBy: { position: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      }),
    ]);

    const rows = productsRaw.map((p) => {
      const prices = p.variants.map((v) => toNum(v.price));
      const priceMin = prices.length ? Math.min(...prices) : 0;
      const priceMax = prices.length ? Math.max(...prices) : 0;
      const totalOnHand = p.variants.reduce(
        (sum, v) => sum + toNum(v.stockItem?.onHand),
        0,
      );
      return {
        title: p.title,
        slug: p.slug,
        brand: p.brand?.name ?? null,
        status: p.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
        variantCount: p.variants.length,
        priceMin,
        priceMax,
        totalOnHand,
        primaryImage: p.images[0]?.url ?? null,
      };
    });

    return { rows, total, page, take };
  }

  // ── GET /products/form-options ───────────────────────────────────────────────
  async productFormOptions(): Promise<FormOptions> {
    const [brands, categories, warehouses] = await Promise.all([
      this.prisma.brand.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.warehousesService.warehouses(),
    ]);
    return { brands, categories, warehouses };
  }

  // ── POST /products ───────────────────────────────────────────────────────────
  async createProduct(dto: CreateProductDto): Promise<CreateProductResult> {
    // ── Pre-checks (pure JS) ─────────────────────────────────────────────────
    // 1. Duplicate SKU within the payload.
    const seenSku = new Map<string, number>();
    for (let i = 0; i < dto.variants.length; i++) {
      const sku = dto.variants[i].sku;
      if (seenSku.has(sku)) {
        throw new BadRequestException(
          fieldError(
            `variants.${i}.sku`,
            `Duplicate SKU "${sku}" in payload`,
            400,
            'ValidationError',
          ),
        );
      }
      seenSku.set(sku, i);
    }

    // 2. Option/variant coherence.
    if (dto.optionTypes.length > 0) {
      // Build name→set(value) lookups (by position-aligned index).
      const valueSets = dto.optionTypes.map(
        (ot) => new Set(ot.values.map((v) => v.value)),
      );
      for (let i = 0; i < dto.variants.length; i++) {
        const v = dto.variants[i];
        if (v.optionValues.length !== dto.optionTypes.length) {
          throw new BadRequestException(
            fieldError(
              `variants.${i}.optionValues`,
              `Expected ${dto.optionTypes.length} option value(s), got ${v.optionValues.length}`,
              400,
              'ValidationError',
            ),
          );
        }
        for (let j = 0; j < v.optionValues.length; j++) {
          if (!valueSets[j].has(v.optionValues[j])) {
            throw new BadRequestException(
              fieldError(
                `variants.${i}.optionValues`,
                `Value "${v.optionValues[j]}" is not a valid value for option "${dto.optionTypes[j].name}"`,
                400,
                'ValidationError',
              ),
            );
          }
        }
      }
    } else if (dto.variants.length !== 1) {
      throw new BadRequestException(
        fieldError(
          'variants',
          'A product with no option types must have exactly one variant',
          400,
          'ValidationError',
        ),
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // ── Pre-checks (DB) ─────────────────────────────────────────────────
        const slugClash = await tx.product.findUnique({
          where: { slug: dto.slug },
          select: { id: true },
        });
        if (slugClash) {
          throw new ConflictException(
            fieldError(
              'slug',
              `Slug "${dto.slug}" is already in use`,
              409,
              'Conflict',
            ),
          );
        }

        const skus = dto.variants.map((v) => v.sku);
        const existingSkus = await tx.variant.findMany({
          where: { sku: { in: skus } },
          select: { sku: true },
        });
        if (existingSkus.length > 0) {
          const skuToIndex = new Map(skus.map((sku, i) => [sku, i]));
          const fieldErrors: Record<string, string[]> = {};
          for (const row of existingSkus) {
            const idx = skuToIndex.get(row.sku);
            if (idx !== undefined) {
              fieldErrors[`variants.${idx}.sku`] = [
                `SKU "${row.sku}" already exists`,
              ];
            }
          }
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            fieldErrors,
            formErrors: [],
          } satisfies StructuredBody);
        }

        try {
          // ── (1) Product + category links ─────────────────────────────────
          const product = await tx.product.create({
            data: {
              title: dto.title,
              slug: dto.slug,
              description: dto.description ?? null,
              status: dto.status,
              brandId: dto.brandId || null,
              metaTitle: dto.metaTitle ?? null,
              metaDescription: dto.metaDescription ?? null,
              categoryLinks: {
                create: dto.categoryIds.map((categoryId) => ({ categoryId })),
              },
            },
            select: { id: true, slug: true, title: true },
          });

          // ── (2) Option types + values → lookup map ───────────────────────
          // Map<optionTypeName, Map<value, optionValueId>>
          const optionValueMap = new Map<string, Map<string, string>>();
          for (let i = 0; i < dto.optionTypes.length; i++) {
            const ot = dto.optionTypes[i];
            const optionType = await tx.optionType.create({
              data: { productId: product.id, name: ot.name, position: i },
              select: { id: true },
            });
            const valueMap = new Map<string, string>();
            for (let j = 0; j < ot.values.length; j++) {
              const ov = await tx.optionValue.create({
                data: {
                  optionTypeId: optionType.id,
                  value: ot.values[j].value,
                  position: j,
                },
                select: { id: true },
              });
              valueMap.set(ot.values[j].value, ov.id);
            }
            optionValueMap.set(ot.name, valueMap);
          }

          // ── (3) Variants (+ option links, stock item, warehouse stock, movements)
          const createdVariants: { id: string }[] = [];
          for (let i = 0; i < dto.variants.length; i++) {
            const v = dto.variants[i];
            const variant = await tx.variant.create({
              data: {
                productId: product.id,
                sku: v.sku,
                barcode: v.barcode ?? null,
                title: v.title || null,
                sourcingType: v.sourcingType,
                price: v.price,
                compareAtPrice: v.compareAtPrice ?? null,
                weightGrams: v.weightGrams ?? null,
                isActive: v.isActive,
                position: i,
              },
              select: { id: true },
            });
            createdVariants.push({ id: variant.id });

            // Variant ↔ option-value links (index-aligned to optionTypes).
            if (dto.optionTypes.length > 0) {
              const links = v.optionValues.map((value, j) => {
                const optionTypeName = dto.optionTypes[j].name;
                const optionValueId = optionValueMap
                  .get(optionTypeName)!
                  .get(value)!;
                return { variantId: variant.id, optionValueId };
              });
              if (links.length > 0) {
                await tx.variantOptionValue.createMany({ data: links });
              }
            }

            // Roll up onHand across stock rows (>0 only) → 4dp money string.
            const sumOnHandNum = v.stock.reduce((sum, s) => {
              const n = Number(s.onHand);
              return n > 0 ? sum + n : sum;
            }, 0);
            const sumOnHand = sumOnHandNum.toFixed(4);

            const stockItem = await tx.stockItem.create({
              data: {
                kind: 'VARIANT',
                variantId: variant.id,
                unitOfMeasure: 'EACH',
                onHand: sumOnHand,
                reserved: '0',
                incoming: '0',
                reorderPoint: v.reorderPoint ?? null,
                reorderQty: v.reorderQty ?? null,
              },
              select: { id: true },
            });

            // Per-warehouse stock + initial RECEIPT movement (only positive rows).
            for (const s of v.stock) {
              if (Number(s.onHand) > 0) {
                await tx.warehouseStockItem.create({
                  data: {
                    stockItemId: stockItem.id,
                    warehouseId: s.warehouseId,
                    onHand: s.onHand,
                    reserved: '0',
                    incoming: '0',
                  },
                });
                await tx.stockMovement.create({
                  data: {
                    stockItemId: stockItem.id,
                    warehouseId: s.warehouseId,
                    qtyDelta: s.onHand,
                    reason: 'RECEIPT',
                    refType: 'ADJUSTMENT',
                    note: 'Initial stock on product creation',
                  },
                });
              }
            }
          }

          // ── (4) Images (normalize a single primary) ──────────────────────
          if (dto.images.length > 0) {
            let primaryAssigned = false;
            const imageData = dto.images.map((img, i) => {
              let isPrimary = false;
              if (img.isPrimary && !primaryAssigned) {
                isPrimary = true;
                primaryAssigned = true;
              }
              const variantId =
                img.variantIndex !== undefined &&
                createdVariants[img.variantIndex]
                  ? createdVariants[img.variantIndex].id
                  : null;
              return {
                isPrimary,
                position: i,
                url: img.url,
                alt: img.alt ?? null,
                variantId,
              };
            });
            // If none flagged primary, mark the first image primary.
            if (!primaryAssigned) {
              imageData[0].isPrimary = true;
            }
            for (const img of imageData) {
              await tx.productImage.create({
                data: {
                  productId: product.id,
                  variantId: img.variantId,
                  url: img.url,
                  alt: img.alt,
                  position: img.position,
                  isPrimary: img.isPrimary,
                },
              });
            }
          }

          // ── (5) Specs ────────────────────────────────────────────────────
          for (let i = 0; i < dto.specs.length; i++) {
            const sp = dto.specs[i];
            await tx.spec.create({
              data: {
                productId: product.id,
                group: sp.group ?? null,
                key: sp.key,
                value: sp.value,
                unit: sp.unit ?? null,
                position: i,
              },
            });
          }

          return {
            id: product.id,
            slug: product.slug,
            title: product.title,
            variantCount: dto.variants.length,
          };
        } catch (e) {
          // Backstop: translate unique-constraint races to structured 409s.
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            const target = e.meta?.target;
            const targets = Array.isArray(target)
              ? (target as string[])
              : typeof target === 'string'
                ? [target]
                : [];
            if (targets.includes('slug')) {
              throw new ConflictException(
                fieldError(
                  'slug',
                  `Slug "${dto.slug}" is already in use`,
                  409,
                  'Conflict',
                ),
              );
            }
            if (targets.includes('sku')) {
              // Cannot know which sku raced; map all payload skus to indices.
              const fieldErrors: Record<string, string[]> = {};
              dto.variants.forEach((v, i) => {
                fieldErrors[`variants.${i}.sku`] = [
                  `SKU "${v.sku}" already exists`,
                ];
              });
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                fieldErrors,
                formErrors: [],
              } satisfies StructuredBody);
            }
          }
          throw e;
        }
      },
      { timeout: 15000 },
    );
  }

  // ── POST /products/brands ────────────────────────────────────────────────────
  async createBrand(dto: CreateBrandDto): Promise<BrandOption> {
    const slug = dto.slug ? dto.slug : deriveSlug(dto.name);
    const clash = await this.prisma.brand.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        fieldError('slug', `Slug "${slug}" is already in use`, 409, 'Conflict'),
      );
    }
    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl ?? null,
        website: dto.website ?? null,
        description: dto.description ?? null,
      },
      select: { id: true, name: true },
    });
    return brand;
  }

  // ── POST /products/categories ────────────────────────────────────────────────
  async createCategory(dto: CreateCategoryDto): Promise<CategoryOption> {
    const slug = dto.slug ? dto.slug : deriveSlug(dto.name);
    const clash = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        fieldError('slug', `Slug "${slug}" is already in use`, 409, 'Conflict'),
      );
    }
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
      },
      select: { id: true, name: true },
    });
    return category;
  }
}
