import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum } from '../common/money';
import { computeStockState } from '../common/stock';
import { fieldError } from '../common/structured-error';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isDefaultWeb: boolean;
}

export interface WarehouseDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  isDefaultWeb: boolean;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  isActive: boolean;
  stockSummary: {
    itemCount: number;
    lowCount: number;
    outCount: number;
  };
}

export interface WarehouseStockResult {
  rows: {
    stockItemId: string;
    name: string;
    sku: string;
    kind: 'VARIANT' | 'MATERIAL';
    uom: string;
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

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /warehouses ──────────────────────────────────────────────────────────
  async warehouses(): Promise<WarehouseRow[]> {
    const rows = await this.prisma.warehouse.findMany({
      where: { deletedAt: null },
      orderBy: [{ isDefaultWeb: 'desc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        isDefaultWeb: true,
      },
    });
    return rows.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      type: w.type,
      isDefaultWeb: w.isDefaultWeb,
    }));
  }

  // ── GET /warehouses/:id ──────────────────────────────────────────────────────
  // Detail with a stock summary computed from the per-warehouse WSI buckets.
  async detail(id: string): Promise<WarehouseDetail> {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        isDefaultWeb: true,
        line1: true,
        line2: true,
        city: true,
        region: true,
        postalCode: true,
        country: true,
        phone: true,
        isActive: true,
        stockItems: {
          select: {
            onHand: true,
            reserved: true,
            reorderPoint: true,
            stockItem: { select: { reorderPoint: true } },
          },
        },
      },
    });

    if (!wh) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    let lowCount = 0;
    let outCount = 0;
    for (const w of wh.stockItems) {
      const available = toNum(w.onHand) - toNum(w.reserved);
      const rp = w.reorderPoint ?? w.stockItem.reorderPoint;
      const reorderPoint = rp === null ? null : toNum(rp);
      const stockState = computeStockState(available, reorderPoint);
      if (stockState === 'LOW') lowCount++;
      else if (stockState === 'OUT') outCount++;
    }

    return {
      id: wh.id,
      code: wh.code,
      name: wh.name,
      type: wh.type,
      isDefaultWeb: wh.isDefaultWeb,
      line1: wh.line1,
      line2: wh.line2,
      city: wh.city,
      region: wh.region,
      postalCode: wh.postalCode,
      country: wh.country,
      phone: wh.phone,
      isActive: wh.isActive,
      stockSummary: {
        itemCount: wh.stockItems.length,
        lowCount,
        outCount,
      },
    };
  }

  // ── GET /warehouses/:id/stock ─────────────────────────────────────────────────
  // Paginated per-warehouse stock view (mirrors inventory.inventoryByWarehouse).
  async stock(
    id: string,
    params: { filter?: string; q?: string; page?: number; take?: number },
  ): Promise<WarehouseStockResult> {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!wh) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    const { page, take, skip } = normalizePaging(params);
    const filter =
      params.filter === 'low' || params.filter === 'out'
        ? params.filter
        : 'all';
    const q = params.q?.trim();

    const where: Prisma.WarehouseStockItemWhereInput = { warehouseId: id };
    if (q) {
      where.stockItem = {
        OR: [
          { variant: { sku: { contains: q, mode: 'insensitive' } } },
          { variant: { title: { contains: q, mode: 'insensitive' } } },
          {
            variant: {
              product: { title: { contains: q, mode: 'insensitive' } },
            },
          },
          { rawMaterial: { sku: { contains: q, mode: 'insensitive' } } },
          { rawMaterial: { name: { contains: q, mode: 'insensitive' } } },
        ],
      };
    }

    const all = await this.prisma.warehouseStockItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        stockItemId: true,
        onHand: true,
        reserved: true,
        incoming: true,
        reorderPoint: true,
        stockItem: {
          select: {
            kind: true,
            unitOfMeasure: true,
            reorderPoint: true,
            variant: {
              select: {
                sku: true,
                title: true,
                product: { select: { title: true } },
              },
            },
            rawMaterial: { select: { sku: true, name: true } },
          },
        },
      },
    });

    const computed = all.map((w) => {
      const s = w.stockItem;
      const onHand = toNum(w.onHand);
      const reserved = toNum(w.reserved);
      const incoming = toNum(w.incoming);
      const available = onHand - reserved;
      // per-warehouse reorder override, falling back to the global StockItem value
      const rp = w.reorderPoint ?? s.reorderPoint;
      const reorderPoint = rp === null ? null : toNum(rp);
      const stockState = computeStockState(available, reorderPoint);

      let name = '';
      let sku = '';
      if (s.variant) {
        name = [s.variant.product?.title, s.variant.title]
          .filter(Boolean)
          .join(' ')
          .trim();
        sku = s.variant.sku;
      } else if (s.rawMaterial) {
        name = s.rawMaterial.name;
        sku = s.rawMaterial.sku;
      }

      return {
        stockItemId: w.stockItemId,
        name,
        sku,
        kind: s.kind,
        uom: s.unitOfMeasure,
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

  // ── POST /warehouses ──────────────────────────────────────────────────────────
  // code unique → 409. If isDefaultWeb, unset the flag on all other warehouses.
  async create(
    dto: CreateWarehouseDto,
  ): Promise<{ id: string; code: string; name: string }> {
    const clash = await this.prisma.warehouse.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        fieldError(
          'code',
          `Code "${dto.code}" is already in use`,
          409,
          'Conflict',
        ),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultWeb) {
        await tx.warehouse.updateMany({
          where: { isDefaultWeb: true },
          data: { isDefaultWeb: false },
        });
      }
      const wh = await tx.warehouse.create({
        data: {
          name: dto.name,
          code: dto.code,
          type: dto.type,
          isDefaultWeb: dto.isDefaultWeb ?? false,
          line1: dto.line1 ?? null,
          line2: dto.line2 ?? null,
          city: dto.city ?? null,
          region: dto.region ?? null,
          postalCode: dto.postalCode ?? null,
          country: dto.country ?? null,
          phone: dto.phone ?? null,
        },
        select: { id: true, code: true, name: true },
      });
      return wh;
    });
  }

  // ── PATCH /warehouses/:id ─────────────────────────────────────────────────────
  async update(id: string, dto: UpdateWarehouseDto): Promise<{ id: string }> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    if (dto.code !== undefined) {
      const clash = await this.prisma.warehouse.findFirst({
        where: { code: dto.code, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          fieldError(
            'code',
            `Code "${dto.code}" is already in use`,
            409,
            'Conflict',
          ),
        );
      }
    }

    const data: Prisma.WarehouseUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.isDefaultWeb !== undefined) data.isDefaultWeb = dto.isDefaultWeb;
    if (dto.line1 !== undefined) data.line1 = dto.line1;
    if (dto.line2 !== undefined) data.line2 = dto.line2;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefaultWeb === true) {
        await tx.warehouse.updateMany({
          where: { isDefaultWeb: true, id: { not: id } },
          data: { isDefaultWeb: false },
        });
      }
      const updated = await tx.warehouse.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: updated.id };
    });
  }

  // ── DELETE /warehouses/:id ────────────────────────────────────────────────────
  // Soft delete. Refuse (409) if the warehouse still holds stock (onHand > 0).
  async remove(id: string): Promise<{ id: string }> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    const withStock = await this.prisma.warehouseStockItem.findFirst({
      where: { warehouseId: id, onHand: { gt: 0 } },
      select: { id: true },
    });
    if (withStock) {
      throw new ConflictException(
        fieldError(
          'id',
          'Cannot delete a warehouse that still holds stock',
          409,
          'Conflict',
        ),
      );
    }

    const deleted = await this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
    return { id: deleted.id };
  }
}
