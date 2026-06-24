import {
  BadRequestException,
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
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SetBranchWarehousesDto } from './dto/set-branch-warehouses.dto';

export interface BranchRow {
  id: string;
  code: string;
  name: string;
  city: string | null;
}

export interface BranchDetail {
  id: string;
  code: string;
  name: string;
  email: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  isActive: boolean;
  warehouses: {
    id: string;
    warehouseId: string;
    code: string;
    name: string;
    type: string;
    priority: number;
    isDefault: boolean;
  }[];
}

export interface BranchInventoryResult {
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
    byWarehouse: {
      warehouseId: string;
      code: string;
      onHand: number;
    }[];
  }[];
  total: number;
  page: number;
  take: number;
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /branches ────────────────────────────────────────────────────────────
  async branches(): Promise<BranchRow[]> {
    const rows = await this.prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, city: true },
    });
    return rows.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      city: b.city,
    }));
  }

  // ── GET /branches/:id ────────────────────────────────────────────────────────
  async detail(id: string): Promise<BranchDetail> {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        line1: true,
        line2: true,
        city: true,
        region: true,
        postalCode: true,
        country: true,
        phone: true,
        isActive: true,
        warehouseLinks: {
          orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
          select: {
            id: true,
            warehouseId: true,
            priority: true,
            isDefault: true,
            warehouse: { select: { code: true, name: true, type: true } },
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${id} not found`);
    }

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      email: branch.email,
      line1: branch.line1,
      line2: branch.line2,
      city: branch.city,
      region: branch.region,
      postalCode: branch.postalCode,
      country: branch.country,
      phone: branch.phone,
      isActive: branch.isActive,
      warehouses: branch.warehouseLinks.map((l) => ({
        id: l.id,
        warehouseId: l.warehouseId,
        code: l.warehouse.code,
        name: l.warehouse.name,
        type: l.warehouse.type,
        priority: l.priority,
        isDefault: l.isDefault,
      })),
    };
  }

  // ── POST /branches ────────────────────────────────────────────────────────────
  async create(
    dto: CreateBranchDto,
  ): Promise<{ id: string; code: string; name: string }> {
    const clash = await this.prisma.branch.findUnique({
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

    const branch = await this.prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code,
        email: dto.email ?? null,
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
    return branch;
  }

  // ── PATCH /branches/:id ───────────────────────────────────────────────────────
  async update(id: string, dto: UpdateBranchDto): Promise<{ id: string }> {
    const existing = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Branch ${id} not found`);
    }

    if (dto.code !== undefined) {
      const clash = await this.prisma.branch.findFirst({
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

    const data: Prisma.BranchUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.line1 !== undefined) data.line1 = dto.line1;
    if (dto.line2 !== undefined) data.line2 = dto.line2;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.branch.update({
      where: { id },
      data,
      select: { id: true },
    });
    return { id: updated.id };
  }

  // ── PUT /branches/:id/warehouses ──────────────────────────────────────────────
  // Replace the branch's BranchWarehouse rows. Enforces at most one default:
  //   - if multiple links flag isDefault, keep the first;
  //   - if none flag it and there are links, the first link becomes default.
  async setWarehouses(
    id: string,
    dto: SetBranchWarehousesDto,
  ): Promise<BranchDetail> {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException(`Branch ${id} not found`);
    }

    // Reject duplicate warehouseIds within the payload.
    const seen = new Set<string>();
    for (let i = 0; i < dto.links.length; i++) {
      const wid = dto.links[i].warehouseId;
      if (seen.has(wid)) {
        throw new BadRequestException(
          fieldError(
            `links.${i}.warehouseId`,
            `Duplicate warehouseId "${wid}" in payload`,
            400,
            'ValidationError',
          ),
        );
      }
      seen.add(wid);
    }

    // Validate each warehouseId exists (and is not soft-deleted).
    if (dto.links.length > 0) {
      const ids = dto.links.map((l) => l.warehouseId);
      const found = await this.prisma.warehouse.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      const foundSet = new Set(found.map((w) => w.id));
      for (let i = 0; i < dto.links.length; i++) {
        if (!foundSet.has(dto.links[i].warehouseId)) {
          throw new BadRequestException(
            fieldError(
              `links.${i}.warehouseId`,
              `Warehouse "${dto.links[i].warehouseId}" not found`,
              400,
              'ValidationError',
            ),
          );
        }
      }
    }

    // Normalize default: at most one. Keep the first flagged; else first link.
    const defaultIdx = dto.links.findIndex((l) => l.isDefault === true);
    const normalized = dto.links.map((l, i) => ({
      warehouseId: l.warehouseId,
      priority: l.priority ?? 0,
      isDefault:
        defaultIdx === -1 ? i === 0 && dto.links.length > 0 : i === defaultIdx,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.branchWarehouse.deleteMany({ where: { branchId: id } });
      if (normalized.length > 0) {
        await tx.branchWarehouse.createMany({
          data: normalized.map((n) => ({
            branchId: id,
            warehouseId: n.warehouseId,
            priority: n.priority,
            isDefault: n.isDefault,
          })),
        });
      }
    });

    return this.detail(id);
  }

  // ── GET /branches/:id/inventory ───────────────────────────────────────────────
  // Derived inventory: aggregate WarehouseStockItem across the branch's linked
  // warehouses, grouped by stockItem. Effective reorderPoint = StockItem.reorderPoint.
  async inventory(
    id: string,
    params: { filter?: string; q?: string; page?: number; take?: number },
  ): Promise<BranchInventoryResult> {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        warehouseLinks: { select: { warehouseId: true } },
      },
    });
    if (!branch) {
      throw new NotFoundException(`Branch ${id} not found`);
    }

    const { page, take, skip } = normalizePaging(params);
    const filter =
      params.filter === 'low' || params.filter === 'out'
        ? params.filter
        : 'all';
    const q = params.q?.trim();

    const warehouseIds = branch.warehouseLinks.map((l) => l.warehouseId);

    // No linked warehouses → nothing to aggregate.
    if (warehouseIds.length === 0) {
      return { rows: [], total: 0, page, take };
    }

    const where: Prisma.WarehouseStockItemWhereInput = {
      warehouseId: { in: warehouseIds },
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
        stockItemId: true,
        warehouseId: true,
        onHand: true,
        reserved: true,
        incoming: true,
        warehouse: { select: { code: true } },
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

    // Group by stockItem, summing buckets across the branch's linked warehouses.
    interface Agg {
      stockItemId: string;
      name: string;
      sku: string;
      kind: 'VARIANT' | 'MATERIAL';
      uom: string;
      onHand: number;
      reserved: number;
      incoming: number;
      reorderPoint: number | null;
      byWarehouse: { warehouseId: string; code: string; onHand: number }[];
    }
    const groups = new Map<string, Agg>();

    for (const w of all) {
      const s = w.stockItem;
      let agg = groups.get(w.stockItemId);
      if (!agg) {
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
        agg = {
          stockItemId: w.stockItemId,
          name,
          sku,
          kind: s.kind,
          uom: s.unitOfMeasure,
          onHand: 0,
          reserved: 0,
          incoming: 0,
          reorderPoint: s.reorderPoint === null ? null : toNum(s.reorderPoint),
          byWarehouse: [],
        };
        groups.set(w.stockItemId, agg);
      }
      const wOnHand = toNum(w.onHand);
      agg.onHand += wOnHand;
      agg.reserved += toNum(w.reserved);
      agg.incoming += toNum(w.incoming);
      agg.byWarehouse.push({
        warehouseId: w.warehouseId,
        code: w.warehouse.code,
        onHand: wOnHand,
      });
    }

    const computed = [...groups.values()].map((agg) => {
      const available = agg.onHand - agg.reserved;
      const stockState = computeStockState(available, agg.reorderPoint);
      return {
        stockItemId: agg.stockItemId,
        name: agg.name,
        sku: agg.sku,
        kind: agg.kind,
        uom: agg.uom,
        onHand: agg.onHand,
        reserved: agg.reserved,
        available,
        incoming: agg.incoming,
        reorderPoint: agg.reorderPoint,
        stockState,
        byWarehouse: agg.byWarehouse,
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
}
