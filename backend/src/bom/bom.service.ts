import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { fieldError } from '../common/structured-error';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

// ─── Response shapes (frontend consumes these via zod) ─────────────────────────

export interface BomVariantsResult {
  rows: {
    variantId: string;
    sku: string;
    title: string;
    sourcingType: 'BUILT' | 'PURCHASED';
    hasActiveBom: boolean;
    activeBomId: string | null;
    versionCount: number;
  }[];
  total: number;
  page: number;
  take: number;
}

export interface BomVersionRow {
  id: string;
  variantId: string;
  version: number;
  isActive: boolean;
  lineCount: number;
  notes: string | null;
  createdAt: string;
}

export interface BomDetailLine {
  id: string;
  stockItemId: string;
  inputKind: 'VARIANT' | 'MATERIAL';
  name: string;
  sku: string;
  uom: string;
  quantity: number;
  scrapPct: number | null;
  isBuilt: boolean;
}

export interface BomDetail {
  id: string;
  variantId: string;
  variantSku: string;
  variantTitle: string;
  version: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  lines: BomDetailLine[];
}

export interface ExplodeNode {
  stockItemId: string;
  name: string;
  sku: string;
  uom: string;
  kind: 'VARIANT' | 'MATERIAL';
  quantityPerParent: number;
  extendedQty: number;
  scrapPct: number | null;
  isBuilt: boolean;
  children: ExplodeNode[];
}

export interface ExplodeResult {
  qty: number;
  tree: ExplodeNode[];
  leaves: {
    stockItemId: string;
    name: string;
    sku: string;
    uom: string;
    totalQty: number;
  }[];
  maxDepth: number;
}

export interface BomCostLine {
  stockItemId: string;
  name: string;
  sku: string;
  qty: number;
  unitStandardCost: number | null;
  lineCost: number | null;
  isBuilt: boolean;
}

export interface BomCostResult {
  qty: number;
  unitCost: number | null;
  extendedCost: number | null;
  lines: BomCostLine[];
  hasMissingCost: boolean;
}

export interface WhereUsedRow {
  bomId: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  version: number;
  isActive: boolean;
  quantity: number;
  unit: string;
}

export interface FeasibilityResult {
  qty: number;
  warehouseId: string;
  canBuild: boolean;
  buildableMax: number;
  shortfalls: {
    stockItemId: string;
    name: string;
    sku: string;
    required: number;
    available: number;
    short: number;
  }[];
}

export interface CreateBomResult {
  id: string;
  variantId: string;
  version: number;
  isActive: boolean;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

// A StockItem with the relations the explosion/cost walks need.
type StockItemMeta = {
  stockItemId: string;
  kind: 'VARIANT' | 'MATERIAL';
  name: string;
  sku: string;
  uom: string;
  standardCost: number | null;
  // present (and active) when this stock item is a BUILT variant
  activeBomId: string | null;
};

// A resolved BOM line (already joined to its input StockItem meta).
interface ResolvedLine {
  meta: StockItemMeta;
  quantity: number;
  scrapPct: number | null;
}

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Naming helper: variant display name. ───────────────────────────────────
  private variantName(
    productTitle: string | undefined,
    variantTitle: string | null | undefined,
  ): string {
    return [productTitle, variantTitle].filter(Boolean).join(' — ').trim();
  }

  // Resolve StockItem metadata (kind/name/sku/uom/standardCost/activeBomId) for
  // a set of stockItemIds. activeBomId is the active BOM of the item's variant
  // (only for VARIANT-kind items whose variant has an active BillOfMaterials).
  private async loadStockItemMeta(
    stockItemIds: string[],
  ): Promise<Map<string, StockItemMeta>> {
    const ids = Array.from(new Set(stockItemIds));
    const map = new Map<string, StockItemMeta>();
    if (ids.length === 0) return map;

    const items = await this.prisma.stockItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        kind: true,
        unitOfMeasure: true,
        standardCost: true,
        variant: {
          select: {
            sku: true,
            title: true,
            product: { select: { title: true } },
            boms: {
              where: { isActive: true },
              select: { id: true },
              take: 1,
            },
          },
        },
        rawMaterial: { select: { sku: true, name: true } },
      },
    });

    for (const it of items) {
      let name = '';
      let sku = '';
      let activeBomId: string | null = null;
      if (it.variant) {
        name = this.variantName(it.variant.product?.title, it.variant.title);
        sku = it.variant.sku;
        activeBomId = it.variant.boms[0]?.id ?? null;
      } else if (it.rawMaterial) {
        name = it.rawMaterial.name;
        sku = it.rawMaterial.sku;
      }
      map.set(it.id, {
        stockItemId: it.id,
        kind: it.kind as 'VARIANT' | 'MATERIAL',
        name,
        sku,
        uom: it.unitOfMeasure,
        standardCost:
          it.standardCost === null ? null : toNum(it.standardCost),
        activeBomId,
      });
    }
    return map;
  }

  // Load a BOM's direct lines, resolved to their input StockItem meta.
  private async loadResolvedLines(bomId: string): Promise<ResolvedLine[]> {
    const lines = await this.prisma.bomLine.findMany({
      where: { bomId },
      orderBy: { id: 'asc' },
      select: {
        stockItemId: true,
        quantity: true,
        scrapPct: true,
      },
    });
    const meta = await this.loadStockItemMeta(lines.map((l) => l.stockItemId));
    return lines.map((l) => {
      const m = meta.get(l.stockItemId);
      return {
        meta:
          m ?? {
            stockItemId: l.stockItemId,
            kind: 'MATERIAL',
            name: '',
            sku: '',
            uom: '',
            standardCost: null,
            activeBomId: null,
          },
        quantity: toNum(l.quantity),
        scrapPct: l.scrapPct === null ? null : toNum(l.scrapPct),
      };
    });
  }

  // ── GET /bom/variants ───────────────────────────────────────────────────────
  async listVariants(params: {
    q?: string;
    page?: number;
    take?: number;
  }): Promise<BomVariantsResult> {
    const { page, take, skip } = normalizePaging(params);
    const q = params.q?.trim();

    const where: Prisma.VariantWhereInput = { deletedAt: null };
    if (q) {
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { product: { title: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, variants] = await Promise.all([
      this.prisma.variant.count({ where }),
      this.prisma.variant.findMany({
        where,
        skip,
        take,
        // Prefer BUILT variants, then most recent.
        orderBy: [{ sourcingType: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          sku: true,
          title: true,
          sourcingType: true,
          product: { select: { title: true } },
          boms: {
            select: { id: true, isActive: true },
          },
        },
      }),
    ]);

    const rows = variants.map((v) => {
      const active = v.boms.find((b) => b.isActive) ?? null;
      return {
        variantId: v.id,
        sku: v.sku,
        title: this.variantName(v.product?.title, v.title),
        sourcingType: v.sourcingType as 'BUILT' | 'PURCHASED',
        hasActiveBom: active !== null,
        activeBomId: active?.id ?? null,
        versionCount: v.boms.length,
      };
    });

    return { rows, total, page, take };
  }

  // ── GET /bom?variantId= ──────────────────────────────────────────────────────
  async listVersions(variantId: string): Promise<BomVersionRow[]> {
    const boms = await this.prisma.billOfMaterials.findMany({
      where: { variantId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        variantId: true,
        version: true,
        isActive: true,
        notes: true,
        createdAt: true,
        _count: { select: { lines: true } },
      },
    });

    return boms.map((b) => ({
      id: b.id,
      variantId: b.variantId,
      version: b.version,
      isActive: b.isActive,
      lineCount: b._count.lines,
      notes: b.notes ?? null,
      createdAt: toISO(b.createdAt) as string,
    }));
  }

  // ── GET /bom/:id ─────────────────────────────────────────────────────────────
  async detail(id: string): Promise<BomDetail> {
    const bom = await this.prisma.billOfMaterials.findUnique({
      where: { id },
      select: {
        id: true,
        variantId: true,
        version: true,
        isActive: true,
        notes: true,
        createdAt: true,
        variant: {
          select: {
            sku: true,
            title: true,
            product: { select: { title: true } },
          },
        },
        lines: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            stockItemId: true,
            quantity: true,
            scrapPct: true,
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundException(`BillOfMaterials ${id} not found`);
    }

    const meta = await this.loadStockItemMeta(
      bom.lines.map((l) => l.stockItemId),
    );

    const lines: BomDetailLine[] = bom.lines.map((l) => {
      const m = meta.get(l.stockItemId);
      return {
        id: l.id,
        stockItemId: l.stockItemId,
        inputKind: m?.kind ?? 'MATERIAL',
        name: m?.name ?? '',
        sku: m?.sku ?? '',
        uom: m?.uom ?? '',
        quantity: toNum(l.quantity),
        scrapPct: l.scrapPct === null ? null : toNum(l.scrapPct),
        isBuilt: (m?.kind === 'VARIANT' && m.activeBomId !== null) || false,
      };
    });

    return {
      id: bom.id,
      variantId: bom.variantId,
      variantSku: bom.variant.sku,
      variantTitle: this.variantName(
        bom.variant.product?.title,
        bom.variant.title,
      ),
      version: bom.version,
      isActive: bom.isActive,
      notes: bom.notes ?? null,
      createdAt: toISO(bom.createdAt) as string,
      lines,
    };
  }

  // ── GET /bom/:id/explode ─────────────────────────────────────────────────────
  // Recursive multi-level explosion with cycle detection. PUBLIC so build-orders
  // can reuse it.
  async explodeBom(bomId: string, qty = 1): Promise<ExplodeResult> {
    // Ensure the root exists (404 otherwise).
    const root = await this.prisma.billOfMaterials.findUnique({
      where: { id: bomId },
      select: { id: true, variantId: true },
    });
    if (!root) {
      throw new NotFoundException(`BillOfMaterials ${bomId} not found`);
    }

    // The root variant's own stock item seeds the recursion-path cycle guard.
    const rootStockItem = await this.prisma.stockItem.findUnique({
      where: { variantId: root.variantId },
      select: { id: true },
    });

    const leafAgg = new Map<
      string,
      { stockItemId: string; name: string; sku: string; uom: string; totalQty: number }
    >();
    let maxDepth = 0;

    const walk = async (
      currentBomId: string,
      multiplier: number,
      path: Set<string>,
      depth: number,
    ): Promise<ExplodeNode[]> => {
      if (depth > maxDepth) maxDepth = depth;
      const lines = await this.loadResolvedLines(currentBomId);
      const nodes: ExplodeNode[] = [];

      for (const line of lines) {
        const m = line.meta;
        const scrap = line.scrapPct ?? 0;
        const quantityPerParent = line.quantity * (1 + scrap);
        const extendedQty = multiplier * quantityPerParent;
        const isBuilt = m.kind === 'VARIANT' && m.activeBomId !== null;

        // Cycle detection along the current recursion path.
        if (isBuilt && path.has(m.stockItemId)) {
          throw new ConflictException(
            fieldError(
              'bom',
              `Cyclic BOM detected at SKU ${m.sku}`,
              409,
              'Conflict',
            ),
          );
        }

        let children: ExplodeNode[] = [];
        if (isBuilt && m.activeBomId) {
          const nextPath = new Set(path);
          nextPath.add(m.stockItemId);
          children = await walk(
            m.activeBomId,
            extendedQty,
            nextPath,
            depth + 1,
          );
        } else {
          // Leaf — aggregate across the whole tree.
          const prev = leafAgg.get(m.stockItemId);
          if (prev) {
            prev.totalQty += extendedQty;
          } else {
            leafAgg.set(m.stockItemId, {
              stockItemId: m.stockItemId,
              name: m.name,
              sku: m.sku,
              uom: m.uom,
              totalQty: extendedQty,
            });
          }
        }

        nodes.push({
          stockItemId: m.stockItemId,
          name: m.name,
          sku: m.sku,
          uom: m.uom,
          kind: m.kind,
          quantityPerParent,
          extendedQty,
          scrapPct: line.scrapPct,
          isBuilt,
          children,
        });
      }

      return nodes;
    };

    const initialPath = new Set<string>();
    if (rootStockItem) initialPath.add(rootStockItem.id);

    const tree = await walk(bomId, qty, initialPath, 0);

    return {
      qty,
      tree,
      leaves: Array.from(leafAgg.values()),
      maxDepth,
    };
  }

  // ── GET /bom/:id/cost ────────────────────────────────────────────────────────
  // Recursive cost rollup. Leaf unit cost = StockItem.standardCost; built node
  // unit cost = rolled cost of its active child BOM. PUBLIC for reuse.
  async costBom(bomId: string, qty = 1): Promise<BomCostResult> {
    const root = await this.prisma.billOfMaterials.findUnique({
      where: { id: bomId },
      select: { id: true, variantId: true },
    });
    if (!root) {
      throw new NotFoundException(`BillOfMaterials ${bomId} not found`);
    }

    // Roll a BOM's per-unit cost (cost to build 1 of its output). Returns null
    // if any contributing leaf has a null standardCost. `path` guards cycles.
    const rollUnitCost = async (
      currentBomId: string,
      path: Set<string>,
    ): Promise<number | null> => {
      const lines = await this.loadResolvedLines(currentBomId);
      let sum = 0;
      let missing = false;
      for (const line of lines) {
        const m = line.meta;
        const scrap = line.scrapPct ?? 0;
        const perUnit = line.quantity * (1 + scrap);
        const isBuilt = m.kind === 'VARIANT' && m.activeBomId !== null;

        let unitCost: number | null;
        if (isBuilt && m.activeBomId) {
          if (path.has(m.stockItemId)) {
            throw new ConflictException(
              fieldError(
                'bom',
                `Cyclic BOM detected at SKU ${m.sku}`,
                409,
                'Conflict',
              ),
            );
          }
          const nextPath = new Set(path);
          nextPath.add(m.stockItemId);
          unitCost = await rollUnitCost(m.activeBomId, nextPath);
        } else {
          unitCost = m.standardCost;
        }

        if (unitCost == null) {
          missing = true;
        } else {
          sum += perUnit * unitCost;
        }
      }
      return missing ? null : sum;
    };

    // Build the per-direct-line breakdown for `qty`.
    const lines = await this.loadResolvedLines(bomId);
    const rootStockItem = await this.prisma.stockItem.findUnique({
      where: { variantId: root.variantId },
      select: { id: true },
    });

    const costLines: BomCostLine[] = [];
    let hasMissingCost = false;

    for (const line of lines) {
      const m = line.meta;
      const scrap = line.scrapPct ?? 0;
      const lineQty = qty * line.quantity * (1 + scrap);
      const isBuilt = m.kind === 'VARIANT' && m.activeBomId !== null;

      let unitStandardCost: number | null;
      if (isBuilt && m.activeBomId) {
        const path = new Set<string>();
        if (rootStockItem) path.add(rootStockItem.id);
        path.add(m.stockItemId);
        unitStandardCost = await rollUnitCost(m.activeBomId, path);
      } else {
        unitStandardCost = m.standardCost;
      }

      const lineCost =
        unitStandardCost == null ? null : lineQty * unitStandardCost;
      if (lineCost == null) hasMissingCost = true;

      costLines.push({
        stockItemId: m.stockItemId,
        name: m.name,
        sku: m.sku,
        qty: lineQty,
        unitStandardCost,
        lineCost,
        isBuilt,
      });
    }

    const initialPath = new Set<string>();
    if (rootStockItem) initialPath.add(rootStockItem.id);
    const unitCost = await rollUnitCost(bomId, initialPath);
    const extendedCost = unitCost == null ? null : unitCost * qty;

    return {
      qty,
      unitCost,
      extendedCost,
      lines: costLines,
      hasMissingCost,
    };
  }

  // ── GET /bom/where-used ──────────────────────────────────────────────────────
  async whereUsed(stockItemId: string): Promise<WhereUsedRow[]> {
    const lines = await this.prisma.bomLine.findMany({
      where: { stockItemId },
      orderBy: { id: 'asc' },
      select: {
        quantity: true,
        unit: true,
        bom: {
          select: {
            id: true,
            variantId: true,
            version: true,
            isActive: true,
            variant: {
              select: {
                sku: true,
                product: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    return lines.map((l) => ({
      bomId: l.bom.id,
      variantId: l.bom.variantId,
      variantSku: l.bom.variant.sku,
      productTitle: l.bom.variant.product?.title ?? '',
      version: l.bom.version,
      isActive: l.bom.isActive,
      quantity: toNum(l.quantity),
      unit: l.unit,
    }));
  }

  // ── GET /bom/:id/feasibility ─────────────────────────────────────────────────
  // Feasibility against the BOM's DIRECT line inputs at one warehouse. PUBLIC.
  async feasibility(
    bomId: string,
    qty: number,
    warehouseId: string,
  ): Promise<FeasibilityResult> {
    const bom = await this.prisma.billOfMaterials.findUnique({
      where: { id: bomId },
      select: { id: true },
    });
    if (!bom) {
      throw new NotFoundException(`BillOfMaterials ${bomId} not found`);
    }

    const lines = await this.loadResolvedLines(bomId);

    // Available per stockItem at this warehouse.
    const stockItemIds = lines.map((l) => l.meta.stockItemId);
    const wsis = await this.prisma.warehouseStockItem.findMany({
      where: { warehouseId, stockItemId: { in: stockItemIds } },
      select: { stockItemId: true, onHand: true, reserved: true },
    });
    const availMap = new Map<string, number>();
    for (const w of wsis) {
      availMap.set(w.stockItemId, toNum(w.onHand) - toNum(w.reserved));
    }

    const shortfalls: FeasibilityResult['shortfalls'] = [];
    let buildableMax = Infinity;

    for (const line of lines) {
      const m = line.meta;
      const scrap = line.scrapPct ?? 0;
      const perUnit = line.quantity * (1 + scrap);
      const required = qty * perUnit;
      const available = availMap.get(m.stockItemId) ?? 0;

      if (perUnit > 0) {
        const lineMax = Math.floor(available / perUnit);
        if (lineMax < buildableMax) buildableMax = lineMax;
      }

      if (available + 1e-9 < required) {
        shortfalls.push({
          stockItemId: m.stockItemId,
          name: m.name,
          sku: m.sku,
          required,
          available,
          short: required - available,
        });
      }
    }

    if (!Number.isFinite(buildableMax)) buildableMax = 0;

    return {
      qty,
      warehouseId,
      canBuild: shortfalls.length === 0,
      buildableMax,
      shortfalls,
    };
  }

  // Direct components (resolved) for a BOM — PUBLIC helper for build-orders.
  // Returns each direct line with its per-unit (scrap-adjusted) quantity and the
  // unit cost build-orders should book (rolled cost for built inputs, standard
  // cost for purchased).
  async bomDirectComponents(bomId: string): Promise<
    {
      stockItemId: string;
      name: string;
      sku: string;
      uom: string;
      kind: 'VARIANT' | 'MATERIAL';
      quantity: number;
      scrapPct: number | null;
      perUnit: number;
      isBuilt: boolean;
      unitCost: number | null;
    }[]
  > {
    const lines = await this.loadResolvedLines(bomId);
    const out: Awaited<ReturnType<BomService['bomDirectComponents']>> = [];

    for (const line of lines) {
      const m = line.meta;
      const scrap = line.scrapPct ?? 0;
      const perUnit = line.quantity * (1 + scrap);
      const isBuilt = m.kind === 'VARIANT' && m.activeBomId !== null;

      let unitCost: number | null;
      if (isBuilt && m.activeBomId) {
        const cost = await this.costBom(m.activeBomId, 1);
        unitCost = cost.unitCost;
      } else {
        unitCost = m.standardCost;
      }

      out.push({
        stockItemId: m.stockItemId,
        name: m.name,
        sku: m.sku,
        uom: m.uom,
        kind: m.kind,
        quantity: line.quantity,
        scrapPct: line.scrapPct,
        perUnit,
        isBuilt,
        unitCost,
      });
    }
    return out;
  }

  // Resolve the active BOM id for a variant (used by build-orders default). null
  // if none.
  async activeBomIdForVariant(variantId: string): Promise<string | null> {
    const bom = await this.prisma.billOfMaterials.findFirst({
      where: { variantId, isActive: true },
      select: { id: true },
    });
    return bom?.id ?? null;
  }

  // ── Shared line validation for create/patch. ────────────────────────────────
  private validateLineShape(
    lines: CreateBomDto['lines'],
    ownStockItemId: string | null,
  ): void {
    // No duplicate stockItemId.
    const seen = new Map<string, number>();
    for (let i = 0; i < lines.length; i++) {
      const sid = lines[i].stockItemId;
      if (seen.has(sid)) {
        throw new BadRequestException(
          fieldError(
            `lines.${i}.stockItemId`,
            `Duplicate stockItemId "${sid}" in lines`,
            400,
            'ValidationError',
          ),
        );
      }
      seen.set(sid, i);
      // First-level cycle guard: a line cannot consume the BOM's own variant.
      if (ownStockItemId && sid === ownStockItemId) {
        throw new BadRequestException(
          fieldError(
            `lines.${i}.stockItemId`,
            'A BOM line cannot consume its own output variant',
            400,
            'ValidationError',
          ),
        );
      }
    }
  }

  // Assert every line stockItemId exists; throw structured 400 on the first miss.
  private async assertLineStockItemsExist(
    tx: Prisma.TransactionClient,
    lines: CreateBomDto['lines'],
  ): Promise<void> {
    const ids = lines.map((l) => l.stockItemId);
    const found = await tx.stockItem.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((f) => f.id));
    for (let i = 0; i < lines.length; i++) {
      if (!foundSet.has(lines[i].stockItemId)) {
        throw new BadRequestException(
          fieldError(
            `lines.${i}.stockItemId`,
            `StockItem "${lines[i].stockItemId}" not found`,
            400,
            'ValidationError',
          ),
        );
      }
    }
  }

  // ── POST /bom ────────────────────────────────────────────────────────────────
  async create(dto: CreateBomDto): Promise<CreateBomResult> {
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.findUnique({
        where: { id: dto.variantId },
        select: { id: true, stockItem: { select: { id: true } } },
      });
      if (!variant) {
        throw new BadRequestException(
          fieldError(
            'variantId',
            `Variant "${dto.variantId}" not found`,
            400,
            'ValidationError',
          ),
        );
      }

      const ownStockItemId = variant.stockItem?.id ?? null;
      this.validateLineShape(dto.lines, ownStockItemId);
      await this.assertLineStockItemsExist(tx, dto.lines);

      // Auto-increment version; first version is active.
      const agg = await tx.billOfMaterials.aggregate({
        where: { variantId: dto.variantId },
        _max: { version: true },
        _count: { _all: true },
      });
      const nextVersion = (agg._max.version ?? 0) + 1;
      const isActive = agg._count._all === 0;

      const bom = await tx.billOfMaterials.create({
        data: {
          variantId: dto.variantId,
          version: nextVersion,
          isActive,
          notes: dto.notes ?? null,
          lines: {
            create: dto.lines.map((l) => ({
              stockItemId: l.stockItemId,
              quantity: l.quantity,
              unit: l.unit,
              scrapPct: l.scrapPct ?? null,
            })),
          },
        },
        select: { id: true, variantId: true, version: true, isActive: true },
      });

      return {
        id: bom.id,
        variantId: bom.variantId,
        version: bom.version,
        isActive: bom.isActive,
      };
    });
  }

  // ── PATCH /bom/:id ───────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateBomDto): Promise<CreateBomResult> {
    return this.prisma.$transaction(async (tx) => {
      const bom = await tx.billOfMaterials.findUnique({
        where: { id },
        select: {
          id: true,
          variantId: true,
          version: true,
          isActive: true,
          variant: { select: { stockItem: { select: { id: true } } } },
        },
      });
      if (!bom) {
        throw new NotFoundException(`BillOfMaterials ${id} not found`);
      }

      // Editing lines is locked once a build order has progressed past PLANNED.
      if (dto.lines !== undefined) {
        const locked = await tx.buildOrder.findFirst({
          where: {
            bomId: id,
            status: { in: ['IN_PROGRESS', 'COMPLETED'] },
          },
          select: { id: true },
        });
        if (locked) {
          throw new ConflictException(
            fieldError(
              'bom',
              'BOM is locked: an in-progress or completed build order references it',
              409,
              'Conflict',
            ),
          );
        }

        const ownStockItemId = bom.variant.stockItem?.id ?? null;
        this.validateLineShape(dto.lines, ownStockItemId);
        await this.assertLineStockItemsExist(tx, dto.lines);

        // Replace lines wholesale.
        await tx.bomLine.deleteMany({ where: { bomId: id } });
        await tx.bomLine.createMany({
          data: dto.lines.map((l) => ({
            bomId: id,
            stockItemId: l.stockItemId,
            quantity: l.quantity,
            unit: l.unit,
            scrapPct: l.scrapPct ?? null,
          })),
        });
      }

      const updated = await tx.billOfMaterials.update({
        where: { id },
        data: { notes: dto.notes ?? undefined },
        select: { id: true, variantId: true, version: true, isActive: true },
      });

      return {
        id: updated.id,
        variantId: updated.variantId,
        version: updated.version,
        isActive: updated.isActive,
      };
    });
  }

  // ── POST /bom/:id/activate ───────────────────────────────────────────────────
  async activate(id: string): Promise<CreateBomResult> {
    return this.prisma.$transaction(async (tx) => {
      const bom = await tx.billOfMaterials.findUnique({
        where: { id },
        select: { id: true, variantId: true, version: true },
      });
      if (!bom) {
        throw new NotFoundException(`BillOfMaterials ${id} not found`);
      }

      // Deactivate all siblings, then activate this one.
      await tx.billOfMaterials.updateMany({
        where: { variantId: bom.variantId },
        data: { isActive: false },
      });
      await tx.billOfMaterials.update({
        where: { id },
        data: { isActive: true },
      });

      return {
        id: bom.id,
        variantId: bom.variantId,
        version: bom.version,
        isActive: true,
      };
    });
  }
}
