import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  ProductStatus,
  SourcingType,
  UnitOfMeasure,
} from '../generated/prisma/client';
import { InventoryPostingService } from '../common/inventory/inventory-posting.service';
import { ProductsService } from '../products/products.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { computeStockState } from '../common/stock';
import { deriveSlug, fieldError } from '../common/structured-error';
import {
  CreateRawMaterialDto,
  UpdateRawMaterialDto,
} from './dto/create-raw-material.dto';
import { PublishRawMaterialDto } from './dto/publish-raw-material.dto';

export interface RawMaterialsResult {
  rows: {
    id: string;
    name: string;
    sku: string;
    uom: string;
    standardCost: number | null;
    onHand: number;
    reserved: number;
    available: number;
    incoming: number;
    reorderPoint: number | null;
    stockState: 'IN_STOCK' | 'LOW' | 'OUT';
  }[];
  total: number;
  page: number;
  take: number;
}

export interface RawMaterialDetail {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  defaultUnit: string;
  trackLot: boolean;
  trackSerial: boolean;
  standardCost: number | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  safetyStock: number | null;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  /** Set once this material has been published as a sellable storefront product. */
  published: {
    variantId: string;
    productId: string;
    slug: string;
    title: string;
  } | null;
  warehouses: {
    warehouseId: string;
    code: string;
    name: string;
    onHand: number;
    reserved: number;
    available: number;
    incoming: number;
    reorderPoint: number | null;
  }[];
  movements: {
    id: string;
    warehouseId: string;
    warehouseCode: string;
    qtyDelta: number;
    reason: string;
    refType: string | null;
    note: string | null;
    createdAt: string | null;
  }[];
}

export interface CreateRawMaterialResult {
  id: string;
  name: string;
  sku: string;
}

export interface PublishRawMaterialResult {
  rawMaterialId: string;
  productId: string;
  variantId: string;
  slug: string;
  title: string;
}

@Injectable()
export class RawMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: InventoryPostingService,
    private readonly products: ProductsService,
  ) {}

  // ── GET /raw-materials ─────────────────────────────────────────────────────
  async rawMaterials(params: {
    q?: string;
    filter?: string;
    page?: number;
    take?: number;
  }): Promise<RawMaterialsResult> {
    const { page, take, skip } = normalizePaging(params);
    const filter =
      params.filter === 'low' || params.filter === 'out'
        ? params.filter
        : 'all';
    const q = params.q?.trim();

    const where: Prisma.RawMaterialWhereInput = { deletedAt: null };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ];
    }

    // stockState depends on (onHand - reserved) vs reorderPoint, a column-to-column
    // compare we cannot express in Prisma. Fetch the matching set, compute state in
    // JS, filter, then paginate (mirrors inventory.service).
    const all = await this.prisma.rawMaterial.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        defaultUnit: true,
        stockItem: {
          select: {
            unitOfMeasure: true,
            standardCost: true,
            onHand: true,
            reserved: true,
            incoming: true,
            reorderPoint: true,
          },
        },
      },
    });

    const computed = all.map((m) => {
      const s = m.stockItem;
      const onHand = toNum(s?.onHand);
      const reserved = toNum(s?.reserved);
      const incoming = toNum(s?.incoming);
      const available = onHand - reserved;
      const reorderPoint =
        s?.reorderPoint == null ? null : toNum(s.reorderPoint);
      const standardCost =
        s?.standardCost == null ? null : toNum(s.standardCost);
      const stockState = computeStockState(available, reorderPoint);

      return {
        id: m.id,
        name: m.name,
        sku: m.sku,
        uom: s?.unitOfMeasure ?? m.defaultUnit,
        standardCost,
        onHand,
        reserved,
        available,
        incoming,
        reorderPoint,
        stockState,
      };
    });

    const filtered = computed.filter((r) => {
      if (filter === 'low') return r.stockState === 'LOW';
      if (filter === 'out') return r.stockState === 'OUT';
      return true;
    });

    const total = filtered.length;
    const rows = filtered.slice(skip, skip + take);

    return { rows, total, page, take };
  }

  // ── GET /raw-materials/:id ─────────────────────────────────────────────────
  async rawMaterial(id: string): Promise<RawMaterialDetail> {
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        defaultUnit: true,
        publishedVariant: {
          select: { id: true, product: { select: { id: true, slug: true, title: true } } },
        },
        stockItem: {
          select: {
            id: true,
            unitOfMeasure: true,
            trackLot: true,
            trackSerial: true,
            standardCost: true,
            reorderPoint: true,
            reorderQty: true,
            safetyStock: true,
            onHand: true,
            reserved: true,
            incoming: true,
            warehouseStock: {
              orderBy: { createdAt: 'asc' },
              select: {
                onHand: true,
                reserved: true,
                incoming: true,
                reorderPoint: true,
                warehouse: { select: { id: true, code: true, name: true } },
              },
            },
            movements: {
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                id: true,
                warehouseId: true,
                qtyDelta: true,
                reason: true,
                refType: true,
                note: true,
                createdAt: true,
                warehouse: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    if (!material) {
      throw new NotFoundException(
        fieldError('id', `Raw material "${id}" not found`, 404, 'NotFound'),
      );
    }

    const s = material.stockItem;
    const onHand = toNum(s?.onHand);
    const reserved = toNum(s?.reserved);
    const incoming = toNum(s?.incoming);

    const warehouses = (s?.warehouseStock ?? []).map((w) => {
      const wOnHand = toNum(w.onHand);
      const wReserved = toNum(w.reserved);
      return {
        warehouseId: w.warehouse.id,
        code: w.warehouse.code,
        name: w.warehouse.name,
        onHand: wOnHand,
        reserved: wReserved,
        available: wOnHand - wReserved,
        incoming: toNum(w.incoming),
        reorderPoint: w.reorderPoint == null ? null : toNum(w.reorderPoint),
      };
    });

    const movements = (s?.movements ?? []).map((mv) => ({
      id: mv.id,
      warehouseId: mv.warehouseId,
      warehouseCode: mv.warehouse.code,
      qtyDelta: toNum(mv.qtyDelta),
      reason: mv.reason,
      refType: mv.refType ?? null,
      note: mv.note ?? null,
      createdAt: toISO(mv.createdAt),
    }));

    return {
      id: material.id,
      name: material.name,
      sku: material.sku,
      description: material.description ?? null,
      defaultUnit: material.defaultUnit,
      trackLot: s?.trackLot ?? false,
      trackSerial: s?.trackSerial ?? false,
      standardCost: s?.standardCost == null ? null : toNum(s.standardCost),
      reorderPoint: s?.reorderPoint == null ? null : toNum(s.reorderPoint),
      reorderQty: s?.reorderQty == null ? null : toNum(s.reorderQty),
      safetyStock: s?.safetyStock == null ? null : toNum(s.safetyStock),
      onHand,
      reserved,
      available: onHand - reserved,
      incoming,
      published: material.publishedVariant
        ? {
            variantId: material.publishedVariant.id,
            productId: material.publishedVariant.product.id,
            slug: material.publishedVariant.product.slug,
            title: material.publishedVariant.product.title,
          }
        : null,
      warehouses,
      movements,
    };
  }

  // ── POST /raw-materials ────────────────────────────────────────────────────
  async createRawMaterial(
    dto: CreateRawMaterialDto,
  ): Promise<CreateRawMaterialResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const skuClash = await tx.rawMaterial.findUnique({
          where: { sku: dto.sku },
          select: { id: true },
        });
        if (skuClash) {
          throw new ConflictException(
            fieldError(
              'sku',
              `SKU "${dto.sku}" is already in use`,
              409,
              'Conflict',
            ),
          );
        }

        const material = await tx.rawMaterial.create({
          data: {
            name: dto.name,
            sku: dto.sku,
            description: dto.description ?? null,
            defaultUnit: dto.defaultUnit,
          },
          select: { id: true, name: true, sku: true },
        });

        const stockItem = await tx.stockItem.create({
          data: {
            kind: 'MATERIAL',
            rawMaterialId: material.id,
            unitOfMeasure: dto.defaultUnit,
            standardCost: dto.standardCost ?? null,
            reorderPoint: dto.reorderPoint ?? null,
            reorderQty: dto.reorderQty ?? null,
            safetyStock: dto.safetyStock ?? null,
            trackLot: dto.trackLot ?? true,
            trackSerial: dto.trackSerial ?? false,
          },
          select: { id: true },
        });

        for (const row of dto.initialStock ?? []) {
          if (Number(row.onHand) > 0) {
            await this.posting.postMovement(tx, {
              stockItemId: stockItem.id,
              warehouseId: row.warehouseId,
              qtyDelta: Number(row.onHand),
              reason: 'RECEIPT',
              refType: 'ADJUSTMENT',
              note: 'Initial stock on material creation',
            });
          }
        }

        return { id: material.id, name: material.name, sku: material.sku };
      },
      { timeout: 15000 },
    );
  }

  // ── PATCH /raw-materials/:id ───────────────────────────────────────────────
  async updateRawMaterial(
    id: string,
    dto: UpdateRawMaterialDto,
  ): Promise<RawMaterialDetail> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.rawMaterial.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, stockItem: { select: { id: true } } },
      });
      if (!existing) {
        throw new NotFoundException(
          fieldError('id', `Raw material "${id}" not found`, 404, 'NotFound'),
        );
      }

      // RawMaterial fields.
      const materialData: Prisma.RawMaterialUpdateInput = {};
      if (dto.name !== undefined) materialData.name = dto.name;
      if (dto.description !== undefined)
        materialData.description = dto.description ?? null;
      if (dto.defaultUnit !== undefined)
        materialData.defaultUnit = dto.defaultUnit;
      if (Object.keys(materialData).length > 0) {
        await tx.rawMaterial.update({ where: { id }, data: materialData });
      }

      // StockItem fields.
      const stockData: Prisma.StockItemUpdateInput = {};
      if (dto.defaultUnit !== undefined)
        stockData.unitOfMeasure = dto.defaultUnit;
      if (dto.standardCost !== undefined)
        stockData.standardCost = dto.standardCost;
      if (dto.reorderPoint !== undefined)
        stockData.reorderPoint = dto.reorderPoint;
      if (dto.reorderQty !== undefined) stockData.reorderQty = dto.reorderQty;
      if (dto.safetyStock !== undefined)
        stockData.safetyStock = dto.safetyStock;
      if (dto.trackLot !== undefined) stockData.trackLot = dto.trackLot;
      if (dto.trackSerial !== undefined)
        stockData.trackSerial = dto.trackSerial;
      if (existing.stockItem && Object.keys(stockData).length > 0) {
        await tx.stockItem.update({
          where: { id: existing.stockItem.id },
          data: stockData,
        });
      }
    });

    return this.rawMaterial(id);
  }

  // ── DELETE /raw-materials/:id ──────────────────────────────────────────────
  async deleteRawMaterial(id: string): Promise<{ id: string }> {
    const existing = await this.prisma.rawMaterial.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(
        fieldError('id', `Raw material "${id}" not found`, 404, 'NotFound'),
      );
    }
    await this.prisma.rawMaterial.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  // ── POST /raw-materials/:id/publish ────────────────────────────────────────
  /**
   * Publish an internal raw material as a sellable storefront Product + Variant.
   * The new variant gets its OWN web-stock pool (StockItem.kind = VARIANT) — it
   * is NOT synced with the material's stock. Records the link on the material so
   * it can't be published twice.
   */
  async publishAsProduct(
    id: string,
    dto: PublishRawMaterialDto,
  ): Promise<PublishRawMaterialResult> {
    const material = await this.prisma.rawMaterial.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        publishedVariantId: true,
      },
    });
    if (!material) {
      throw new NotFoundException(
        fieldError('id', `Raw material "${id}" not found`, 404, 'NotFound'),
      );
    }
    if (material.publishedVariantId) {
      throw new BadRequestException(
        fieldError(
          'id',
          'This raw material has already been published as a product.',
          400,
          'BadRequest',
        ),
      );
    }

    // The storefront catalog only surfaces stock at the default web warehouse.
    const webWarehouse = await this.prisma.warehouse.findFirst({
      where: { isDefaultWeb: true },
      select: { id: true },
    });
    if (!webWarehouse) {
      throw new BadRequestException(
        fieldError(
          'initialStock',
          'No default web warehouse is configured to hold sellable stock.',
          400,
          'BadRequest',
        ),
      );
    }

    const sku = dto.sku?.trim() || material.sku;
    const slug = dto.slug?.trim() || deriveSlug(material.name);
    const initialStock = dto.initialStock ?? '0';
    const hasStock = Number(initialStock) > 0;

    const productDto: CreateProductDto = {
      title: material.name,
      slug,
      description: material.description ?? undefined,
      status: ProductStatus.ACTIVE,
      categoryIds: dto.categoryId ? [dto.categoryId] : [],
      optionTypes: [],
      variants: [
        {
          sku,
          sourcingType: SourcingType.PURCHASED,
          price: dto.price,
          isActive: true,
          optionValues: [],
          stock: hasStock
            ? [{ warehouseId: webWarehouse.id, onHand: initialStock }]
            : [],
        },
      ],
      images: [],
      specs: [],
    };

    // Reuses the canonical create path (Product + Variant + StockItem +
    // WarehouseStockItem + RECEIPT movement, all in one transaction). It returns
    // no variant id, so we look the variant up by its unique SKU afterwards.
    const product = await this.products.createProduct(productDto);
    const variant = await this.prisma.variant.findUnique({
      where: { sku },
      select: { id: true },
    });
    if (!variant) {
      throw new Error('Published variant not found immediately after creation');
    }

    await this.prisma.rawMaterial.update({
      where: { id: material.id },
      data: { publishedVariantId: variant.id },
    });

    return {
      rawMaterialId: material.id,
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      title: product.title,
    };
  }
}
