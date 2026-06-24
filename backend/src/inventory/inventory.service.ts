import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { computeStockState } from '../common/stock';
import { InventoryPostingService } from '../common/inventory/inventory-posting.service';
import { AdjustStockDto, SetReorderDto } from './dto/stock-mutation.dto';

export interface InventoryResult {
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

export interface InventoryDetailResult {
  id: string;
  kind: 'VARIANT' | 'MATERIAL';
  name: string;
  sku: string;
  uom: string;
  standardCost: number | null;
  onHand: number;
  reserved: number;
  available: number;
  incoming: number;
  reorderPoint: number | null;
  reorderQty: number | null;
  safetyStock: number | null;
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
    refId: string | null;
    note: string | null;
    createdAt: string;
  }[];
}

export interface AdjustStockResult {
  stockItemId: string;
  warehouse: {
    warehouseId: string;
    onHand: number;
    reserved: number;
    available: number;
    incoming: number;
  };
  rollup: {
    onHand: number;
    reserved: number;
    available: number;
    incoming: number;
  };
}

export interface InventoryOption {
  stockItemId: string;
  kind: 'VARIANT' | 'MATERIAL';
  name: string;
  sku: string;
  uom: string;
  standardCost: number | null;
  price: number | null; // variant sale price (null for raw materials)
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: InventoryPostingService,
  ) {}

  // ── GET /inventory/options ─────────────────────────────────────────────────
  // Lightweight pickable list of stock items (by stockItemId) for transfer-line
  // and BOM-line selectors. Optional kind filter (VARIANT|MATERIAL); capped at 50.
  async options(params: {
    q?: string;
    kind?: string;
  }): Promise<InventoryOption[]> {
    const q = params.q?.trim();
    const where: Prisma.StockItemWhereInput = {};
    if (params.kind === 'VARIANT' || params.kind === 'MATERIAL') {
      where.kind = params.kind;
    }
    if (q) {
      where.OR = [
        { variant: { sku: { contains: q, mode: 'insensitive' } } },
        { variant: { title: { contains: q, mode: 'insensitive' } } },
        {
          variant: { product: { title: { contains: q, mode: 'insensitive' } } },
        },
        { rawMaterial: { sku: { contains: q, mode: 'insensitive' } } },
        { rawMaterial: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const items = await this.prisma.stockItem.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        kind: true,
        unitOfMeasure: true,
        standardCost: true,
        variant: {
          select: {
            sku: true,
            title: true,
            price: true,
            product: { select: { title: true } },
          },
        },
        rawMaterial: { select: { sku: true, name: true } },
      },
    });
    return items.map((s) => {
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
        stockItemId: s.id,
        kind: s.kind,
        name,
        sku,
        uom: s.unitOfMeasure,
        standardCost: s.standardCost === null ? null : toNum(s.standardCost),
        price: s.variant?.price != null ? toNum(s.variant.price) : null,
      };
    });
  }

  // ── GET /inventory ───────────────────────────────────────────────────────────
  // Without warehouseId: the global rollup view (StockItem buckets).
  // With warehouseId: per-warehouse view (WarehouseStockItem buckets).
  async inventory(params: {
    filter?: string;
    q?: string;
    page?: number;
    take?: number;
    warehouseId?: string;
  }): Promise<InventoryResult> {
    if (params.warehouseId) {
      return this.inventoryByWarehouse({
        ...params,
        warehouseId: params.warehouseId,
      });
    }
    const { page, take, skip } = normalizePaging(params);
    const filter =
      params.filter === 'low' || params.filter === 'out'
        ? params.filter
        : 'all';
    const q = params.q?.trim();

    // Build a name/sku search filter against the joined Variant->Product or RawMaterial.
    const where: Prisma.StockItemWhereInput = {};
    if (q) {
      where.OR = [
        { variant: { sku: { contains: q, mode: 'insensitive' } } },
        { variant: { title: { contains: q, mode: 'insensitive' } } },
        {
          variant: {
            product: { title: { contains: q, mode: 'insensitive' } },
          },
        },
        { rawMaterial: { sku: { contains: q, mode: 'insensitive' } } },
        { rawMaterial: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // stockState depends on (onHand - reserved) vs reorderPoint, which we cannot
    // express directly in a Prisma where filter (column-to-column compare). So we
    // fetch the matching set, compute state in JS, filter, then paginate.
    const all = await this.prisma.stockItem.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        kind: true,
        onHand: true,
        reserved: true,
        incoming: true,
        reorderPoint: true,
        unitOfMeasure: true,
        variant: {
          select: {
            sku: true,
            title: true,
            product: { select: { title: true } },
          },
        },
        rawMaterial: { select: { sku: true, name: true } },
      },
    });

    const computed = all.map((s) => {
      const onHand = toNum(s.onHand);
      const reserved = toNum(s.reserved);
      const incoming = toNum(s.incoming);
      const available = onHand - reserved;
      const reorderPoint =
        s.reorderPoint === null ? null : toNum(s.reorderPoint);
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
        stockItemId: s.id,
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

  // Per-warehouse inventory view backed by WarehouseStockItem.
  private async inventoryByWarehouse(params: {
    warehouseId: string;
    filter?: string;
    q?: string;
    page?: number;
    take?: number;
  }): Promise<InventoryResult> {
    const { page, take, skip } = normalizePaging(params);
    const filter =
      params.filter === 'low' || params.filter === 'out'
        ? params.filter
        : 'all';
    const q = params.q?.trim();

    const where: Prisma.WarehouseStockItemWhereInput = {
      warehouseId: params.warehouseId,
    };
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
        onHand: true,
        reserved: true,
        incoming: true,
        reorderPoint: true,
        stockItem: {
          select: {
            id: true,
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
        stockItemId: s.id,
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

  // ── GET /inventory/:stockItemId ──────────────────────────────────────────────
  // Full detail: rollup buckets, per-warehouse breakdown, and the last 100
  // movements (newest first). 404 if the StockItem does not exist.
  async detail(stockItemId: string): Promise<InventoryDetailResult> {
    const item = await this.prisma.stockItem.findUnique({
      where: { id: stockItemId },
      select: {
        id: true,
        kind: true,
        unitOfMeasure: true,
        standardCost: true,
        onHand: true,
        reserved: true,
        incoming: true,
        reorderPoint: true,
        reorderQty: true,
        safetyStock: true,
        variant: {
          select: {
            sku: true,
            title: true,
            product: { select: { title: true } },
          },
        },
        rawMaterial: { select: { sku: true, name: true } },
        warehouseStock: {
          orderBy: { createdAt: 'asc' },
          select: {
            warehouseId: true,
            onHand: true,
            reserved: true,
            incoming: true,
            reorderPoint: true,
            warehouse: { select: { code: true, name: true } },
          },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            warehouseId: true,
            qtyDelta: true,
            reason: true,
            refType: true,
            refId: true,
            note: true,
            createdAt: true,
            warehouse: { select: { code: true } },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`StockItem ${stockItemId} not found`);
    }

    let name = '';
    let sku = '';
    if (item.variant) {
      name = [item.variant.product?.title, item.variant.title]
        .filter(Boolean)
        .join(' ')
        .trim();
      sku = item.variant.sku;
    } else if (item.rawMaterial) {
      name = item.rawMaterial.name;
      sku = item.rawMaterial.sku;
    }

    const onHand = toNum(item.onHand);
    const reserved = toNum(item.reserved);
    const incoming = toNum(item.incoming);
    const globalReorderPoint =
      item.reorderPoint === null ? null : toNum(item.reorderPoint);

    const warehouses = item.warehouseStock.map((w) => {
      const wOnHand = toNum(w.onHand);
      const wReserved = toNum(w.reserved);
      const wIncoming = toNum(w.incoming);
      // effective reorder point: per-warehouse override falls back to the global value
      const rp = w.reorderPoint ?? item.reorderPoint;
      return {
        warehouseId: w.warehouseId,
        code: w.warehouse.code,
        name: w.warehouse.name,
        onHand: wOnHand,
        reserved: wReserved,
        available: wOnHand - wReserved,
        incoming: wIncoming,
        reorderPoint: rp === null ? null : toNum(rp),
      };
    });

    const movements = item.movements.map((m) => ({
      id: m.id,
      warehouseId: m.warehouseId,
      warehouseCode: m.warehouse.code,
      qtyDelta: toNum(m.qtyDelta),
      reason: m.reason,
      refType: m.refType ?? null,
      refId: m.refId ?? null,
      note: m.note ?? null,
      createdAt: toISO(m.createdAt) as string,
    }));

    return {
      id: item.id,
      kind: item.kind,
      name,
      sku,
      uom: item.unitOfMeasure,
      standardCost:
        item.standardCost === null ? null : toNum(item.standardCost),
      onHand,
      reserved,
      available: onHand - reserved,
      incoming,
      reorderPoint: globalReorderPoint,
      reorderQty: item.reorderQty === null ? null : toNum(item.reorderQty),
      safetyStock: item.safetyStock === null ? null : toNum(item.safetyStock),
      warehouses,
      movements,
    };
  }

  // ── POST /inventory/:stockItemId/adjust ──────────────────────────────────────
  // Manual stock adjustment at one warehouse. Routes through the shared posting
  // service inside a transaction (it blocks driving onHand negative with a 409).
  async adjust(
    stockItemId: string,
    dto: AdjustStockDto,
  ): Promise<AdjustStockResult> {
    return this.prisma.$transaction(async (tx) => {
      const rollup = await this.posting.postMovement(tx, {
        stockItemId,
        warehouseId: dto.warehouseId,
        qtyDelta: Number(dto.qtyDelta),
        reason: 'ADJUST',
        refType: 'ADJUSTMENT',
        note: dto.note ?? null,
      });

      // Re-read the per-warehouse bucket for its recomputed values.
      const wsi = await tx.warehouseStockItem.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId,
            warehouseId: dto.warehouseId,
          },
        },
        select: { onHand: true, reserved: true, incoming: true },
      });
      const wOnHand = toNum(wsi?.onHand);
      const wReserved = toNum(wsi?.reserved);
      const wIncoming = toNum(wsi?.incoming);

      return {
        stockItemId,
        warehouse: {
          warehouseId: dto.warehouseId,
          onHand: wOnHand,
          reserved: wReserved,
          available: wOnHand - wReserved,
          incoming: wIncoming,
        },
        rollup: {
          onHand: rollup.onHand,
          reserved: rollup.reserved,
          available: rollup.onHand - rollup.reserved,
          incoming: rollup.incoming,
        },
      };
    });
  }

  // ── PATCH /inventory/:stockItemId/reorder ────────────────────────────────────
  // Set/clear the global StockItem reorder fields. null clears a field.
  async setReorder(
    stockItemId: string,
    dto: SetReorderDto,
  ): Promise<{ id: string }> {
    const exists = await this.prisma.stockItem.findUnique({
      where: { id: stockItemId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`StockItem ${stockItemId} not found`);
    }

    const data: Prisma.StockItemUpdateInput = {};
    if (dto.reorderPoint !== undefined) data.reorderPoint = dto.reorderPoint;
    if (dto.reorderQty !== undefined) data.reorderQty = dto.reorderQty;
    if (dto.safetyStock !== undefined) data.safetyStock = dto.safetyStock;

    const updated = await this.prisma.stockItem.update({
      where: { id: stockItemId },
      data,
      select: { id: true },
    });
    return { id: updated.id };
  }

  // ── PATCH /inventory/:stockItemId/warehouses/:warehouseId/reorder ─────────────
  // Per-warehouse reorder overrides. Upserts the WarehouseStockItem bucket.
  async setWarehouseReorder(
    stockItemId: string,
    warehouseId: string,
    dto: SetReorderDto,
  ): Promise<{ stockItemId: string; warehouseId: string }> {
    const reorderPoint =
      dto.reorderPoint === undefined ? null : dto.reorderPoint;
    const reorderQty = dto.reorderQty === undefined ? null : dto.reorderQty;
    const safetyStock = dto.safetyStock === undefined ? null : dto.safetyStock;

    await this.prisma.warehouseStockItem.upsert({
      where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
      create: {
        stockItemId,
        warehouseId,
        reorderPoint,
        reorderQty,
        safetyStock,
      },
      update: { reorderPoint, reorderQty, safetyStock },
    });
    return { stockItemId, warehouseId };
  }
}
