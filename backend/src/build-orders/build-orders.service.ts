import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, BuildStatus } from '../generated/prisma/client';
import { InventoryPostingService } from '../common/inventory/inventory-posting.service';
import { BomService } from '../bom/bom.service';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { fieldError } from '../common/structured-error';
import { CreateBuildOrderDto } from './dto/create-build-order.dto';
import { CompleteBuildDto } from './dto/complete-build.dto';

// ─── Response shapes (frontend consumes these via zod) ─────────────────────────

export interface BuildOrdersResult {
  rows: {
    id: string;
    variantId: string;
    sku: string;
    productTitle: string;
    status: BuildStatus;
    qtyPlanned: number;
    qtyProduced: number;
    warehouseCode: string;
    bomVersion: number;
    createdAt: string;
  }[];
  total: number;
  page: number;
  take: number;
}

export interface BuildOrderDetail {
  id: string;
  variant: { id: string; sku: string; title: string };
  bom: { id: string; version: number };
  warehouse: { id: string; code: string; name: string };
  status: BuildStatus;
  qtyPlanned: number;
  qtyProduced: number;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  components: {
    stockItemId: string;
    name: string;
    sku: string;
    uom: string;
    perUnit: number;
    requiredForPlanned: number;
    scrapPct: number | null;
  }[];
  consumptions: {
    stockItemId: string;
    name: string;
    sku: string;
    quantity: number;
    unitCost: number | null;
    warehouseCode: string;
  }[];
  outputs: {
    stockItemId: string;
    name: string;
    sku: string;
    quantity: number;
    computedUnitCost: number;
    lotCode: string;
  }[];
}

@Injectable()
export class BuildOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: InventoryPostingService,
    private readonly bom: BomService,
  ) {}

  private variantName(
    productTitle: string | undefined,
    variantTitle: string | null | undefined,
  ): string {
    return [productTitle, variantTitle].filter(Boolean).join(' — ').trim();
  }

  // ── GET /build-orders ────────────────────────────────────────────────────────
  async list(params: {
    status?: string;
    page?: number;
    take?: number;
  }): Promise<BuildOrdersResult> {
    const { page, take, skip } = normalizePaging(params);

    const where: Prisma.BuildOrderWhereInput = {};
    if (params.status && params.status in BuildStatus) {
      where.status = params.status as BuildStatus;
    }

    const [total, rows] = await Promise.all([
      this.prisma.buildOrder.count({ where }),
      this.prisma.buildOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          variantId: true,
          status: true,
          qtyPlanned: true,
          qtyProduced: true,
          createdAt: true,
          variant: {
            select: {
              sku: true,
              product: { select: { title: true } },
            },
          },
          warehouse: { select: { code: true } },
          bom: { select: { version: true } },
        },
      }),
    ]);

    return {
      rows: rows.map((b) => ({
        id: b.id,
        variantId: b.variantId,
        sku: b.variant.sku,
        productTitle: b.variant.product?.title ?? '',
        status: b.status,
        qtyPlanned: toNum(b.qtyPlanned),
        qtyProduced: toNum(b.qtyProduced),
        warehouseCode: b.warehouse.code,
        bomVersion: b.bom.version,
        createdAt: toISO(b.createdAt) as string,
      })),
      total,
      page,
      take,
    };
  }

  // ── GET /build-orders/:id ────────────────────────────────────────────────────
  async detail(id: string): Promise<BuildOrderDetail> {
    const bo = await this.prisma.buildOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        qtyPlanned: true,
        qtyProduced: true,
        startedAt: true,
        completedAt: true,
        notes: true,
        createdAt: true,
        bomId: true,
        variant: {
          select: {
            id: true,
            sku: true,
            title: true,
            product: { select: { title: true } },
          },
        },
        bom: { select: { id: true, version: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        consumptions: {
          orderBy: { createdAt: 'asc' },
          select: {
            stockItemId: true,
            quantity: true,
            unitCostAtConsume: true,
            warehouse: { select: { code: true } },
            stockItem: {
              select: {
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
        },
        outputs: {
          orderBy: { createdAt: 'asc' },
          select: {
            stockItemId: true,
            quantity: true,
            computedUnitCost: true,
            lot: { select: { code: true } },
            stockItem: {
              select: {
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
        },
      },
    });

    if (!bo) {
      throw new NotFoundException(`BuildOrder ${id} not found`);
    }

    const qtyPlanned = toNum(bo.qtyPlanned);
    const directComponents = await this.bom.bomDirectComponents(bo.bomId);

    const components = directComponents.map((c) => ({
      stockItemId: c.stockItemId,
      name: c.name,
      sku: c.sku,
      uom: c.uom,
      perUnit: c.perUnit,
      requiredForPlanned: qtyPlanned * c.perUnit,
      scrapPct: c.scrapPct,
    }));

    const nameSku = (si: {
      variant: {
        sku: string;
        title: string | null;
        product: { title: string } | null;
      } | null;
      rawMaterial: { sku: string; name: string } | null;
    }): { name: string; sku: string } => {
      if (si.variant) {
        return {
          name: this.variantName(si.variant.product?.title, si.variant.title),
          sku: si.variant.sku,
        };
      }
      if (si.rawMaterial) {
        return { name: si.rawMaterial.name, sku: si.rawMaterial.sku };
      }
      return { name: '', sku: '' };
    };

    const consumptions = bo.consumptions.map((c) => {
      const { name, sku } = nameSku(c.stockItem);
      return {
        stockItemId: c.stockItemId,
        name,
        sku,
        quantity: toNum(c.quantity),
        unitCost:
          c.unitCostAtConsume === null ? null : toNum(c.unitCostAtConsume),
        warehouseCode: c.warehouse.code,
      };
    });

    const outputs = bo.outputs.map((o) => {
      const { name, sku } = nameSku(o.stockItem);
      return {
        stockItemId: o.stockItemId,
        name,
        sku,
        quantity: toNum(o.quantity),
        computedUnitCost: toNum(o.computedUnitCost),
        lotCode: o.lot.code,
      };
    });

    return {
      id: bo.id,
      variant: {
        id: bo.variant.id,
        sku: bo.variant.sku,
        title: this.variantName(bo.variant.product?.title, bo.variant.title),
      },
      bom: { id: bo.bom.id, version: bo.bom.version },
      warehouse: {
        id: bo.warehouse.id,
        code: bo.warehouse.code,
        name: bo.warehouse.name,
      },
      status: bo.status,
      qtyPlanned,
      qtyProduced: toNum(bo.qtyProduced),
      startedAt: toISO(bo.startedAt),
      completedAt: toISO(bo.completedAt),
      notes: bo.notes ?? null,
      createdAt: toISO(bo.createdAt) as string,
      components,
      consumptions,
      outputs,
    };
  }

  // ── POST /build-orders ───────────────────────────────────────────────────────
  async create(dto: CreateBuildOrderDto): Promise<{ id: string }> {
    const variant = await this.prisma.variant.findUnique({
      where: { id: dto.variantId },
      select: { id: true },
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

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
      select: { id: true },
    });
    if (!warehouse) {
      throw new BadRequestException(
        fieldError(
          'warehouseId',
          `Warehouse "${dto.warehouseId}" not found`,
          400,
          'ValidationError',
        ),
      );
    }

    // Resolve the BOM: explicit bomId, else the variant's active BOM (404).
    let bomId = dto.bomId;
    if (bomId) {
      const bom = await this.prisma.billOfMaterials.findUnique({
        where: { id: bomId },
        select: { id: true, variantId: true },
      });
      if (!bom) {
        throw new BadRequestException(
          fieldError(
            'bomId',
            `BillOfMaterials "${bomId}" not found`,
            400,
            'ValidationError',
          ),
        );
      }
      if (bom.variantId !== dto.variantId) {
        throw new BadRequestException(
          fieldError(
            'bomId',
            'BOM does not belong to the specified variant',
            400,
            'ValidationError',
          ),
        );
      }
    } else {
      const active = await this.bom.activeBomIdForVariant(dto.variantId);
      if (!active) {
        throw new NotFoundException(
          fieldError(
            'bomId',
            `No active BOM for variant "${dto.variantId}"`,
            404,
            'NotFound',
          ),
        );
      }
      bomId = active;
    }

    const created = await this.prisma.buildOrder.create({
      data: {
        variantId: dto.variantId,
        bomId,
        warehouseId: dto.warehouseId,
        status: 'DRAFT',
        qtyPlanned: dto.qtyPlanned,
        notes: dto.notes ?? null,
      },
      select: { id: true },
    });

    return { id: created.id };
  }

  // Load the build order with the fields lifecycle ops need.
  private async loadForLifecycle(id: string) {
    const bo = await this.prisma.buildOrder.findUnique({
      where: { id },
      select: {
        id: true,
        bomId: true,
        variantId: true,
        warehouseId: true,
        status: true,
        qtyPlanned: true,
      },
    });
    if (!bo) {
      throw new NotFoundException(`BuildOrder ${id} not found`);
    }
    return bo;
  }

  // ── POST /build-orders/:id/plan ──────────────────────────────────────────────
  async plan(id: string): Promise<{ id: string; status: BuildStatus }> {
    const bo = await this.loadForLifecycle(id);
    if (bo.status !== 'DRAFT') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot plan a build order in status ${bo.status}`,
          409,
          'Conflict',
        ),
      );
    }

    const components = await this.bom.bomDirectComponents(bo.bomId);
    const qtyPlanned = toNum(bo.qtyPlanned);

    return this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        const required = qtyPlanned * c.perUnit;
        if (required <= 0) continue;
        await this.posting.assertAvailable(
          tx,
          c.stockItemId,
          bo.warehouseId,
          required,
          `components.${i}`,
        );
        await this.posting.reserve(tx, {
          stockItemId: c.stockItemId,
          warehouseId: bo.warehouseId,
          qty: required,
          refType: 'BUILD_ORDER',
          refId: bo.id,
        });
      }

      await tx.buildOrder.update({
        where: { id: bo.id },
        data: { status: 'PLANNED' },
      });

      return { id: bo.id, status: 'PLANNED' as BuildStatus };
    });
  }

  // ── POST /build-orders/:id/start ─────────────────────────────────────────────
  async start(id: string): Promise<{ id: string; status: BuildStatus }> {
    const bo = await this.loadForLifecycle(id);
    if (bo.status !== 'PLANNED') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot start a build order in status ${bo.status}`,
          409,
          'Conflict',
        ),
      );
    }

    await this.prisma.buildOrder.update({
      where: { id: bo.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    return { id: bo.id, status: 'IN_PROGRESS' };
  }

  // ── POST /build-orders/:id/complete ──────────────────────────────────────────
  async complete(
    id: string,
    dto: CompleteBuildDto,
  ): Promise<{ id: string; status: BuildStatus; computedUnitCost: number }> {
    const bo = await this.loadForLifecycle(id);
    if (bo.status !== 'PLANNED' && bo.status !== 'IN_PROGRESS') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot complete a build order in status ${bo.status}`,
          409,
          'Conflict',
        ),
      );
    }

    const components = await this.bom.bomDirectComponents(bo.bomId);
    const qtyPlanned = toNum(bo.qtyPlanned);
    const qtyProduced = Number(dto.qtyProduced);
    if (qtyProduced <= 0) {
      throw new BadRequestException(
        fieldError(
          'qtyProduced',
          'qtyProduced must be greater than zero',
          400,
          'ValidationError',
        ),
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // a. Release the planned reservations (recompute against qtyPlanned).
        for (const c of components) {
          const plannedRequired = qtyPlanned * c.perUnit;
          if (plannedRequired <= 0) continue;
          await this.posting.release(tx, {
            stockItemId: c.stockItemId,
            warehouseId: bo.warehouseId,
            qty: plannedRequired,
            refType: 'BUILD_ORDER',
            refId: bo.id,
          });
        }

        // b. Consume direct components for qtyProduced + record consumptions.
        // c. Accumulate the produced unit cost as we go.
        let totalCost = 0;
        for (let i = 0; i < components.length; i++) {
          const c = components[i];
          const consumeQty = qtyProduced * c.perUnit;
          if (consumeQty <= 0) continue;

          await this.posting.assertAvailable(
            tx,
            c.stockItemId,
            bo.warehouseId,
            consumeQty,
            `components.${i}`,
          );
          await this.posting.postMovement(tx, {
            stockItemId: c.stockItemId,
            warehouseId: bo.warehouseId,
            qtyDelta: -consumeQty,
            reason: 'BUILD_CONSUME',
            refType: 'BUILD_ORDER',
            refId: bo.id,
            unitCostAtMove: c.unitCost,
            field: `components.${i}`,
          });
          await tx.buildConsumption.create({
            data: {
              buildOrderId: bo.id,
              stockItemId: c.stockItemId,
              warehouseId: bo.warehouseId,
              quantity: consumeQty.toFixed(4),
              unitCostAtConsume:
                c.unitCost === null ? null : c.unitCost.toFixed(4),
            },
          });

          // null cost contributes 0 to the summable part.
          if (c.unitCost != null) {
            totalCost += consumeQty * c.unitCost;
          }
        }

        // c. computedUnitCost = Σ(consumeQty*unitCost) / qtyProduced.
        const computedUnitCost = totalCost / qtyProduced;

        // d. Ensure the output variant has a StockItem (create if missing).
        let outputStockItem = await tx.stockItem.findUnique({
          where: { variantId: bo.variantId },
          select: { id: true },
        });
        if (!outputStockItem) {
          outputStockItem = await tx.stockItem.create({
            data: {
              kind: 'VARIANT',
              variantId: bo.variantId,
              unitOfMeasure: 'EACH',
              onHand: '0',
              reserved: '0',
              incoming: '0',
            },
            select: { id: true },
          });
        }
        const outputStockItemId = outputStockItem.id;

        // Finished-good lot.
        const lot = await tx.lot.create({
          data: {
            stockItemId: outputStockItemId,
            warehouseId: bo.warehouseId,
            code: `BUILD-${bo.id.slice(-8)}`,
            unitCost: computedUnitCost.toFixed(4),
            qtyReceived: qtyProduced.toFixed(4),
            qtyRemaining: qtyProduced.toFixed(4),
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        // e. Produce the finished good + record the output.
        await this.posting.postMovement(tx, {
          stockItemId: outputStockItemId,
          warehouseId: bo.warehouseId,
          qtyDelta: qtyProduced,
          reason: 'BUILD_PRODUCE',
          refType: 'BUILD_ORDER',
          refId: bo.id,
          unitCostAtMove: computedUnitCost,
        });
        await tx.buildOutput.create({
          data: {
            buildOrderId: bo.id,
            stockItemId: outputStockItemId,
            warehouseId: bo.warehouseId,
            lotId: lot.id,
            quantity: qtyProduced.toFixed(4),
            computedUnitCost: computedUnitCost.toFixed(4),
          },
        });

        // f. Finalize.
        await tx.buildOrder.update({
          where: { id: bo.id },
          data: {
            qtyProduced: qtyProduced.toFixed(4),
            completedAt: new Date(),
            status: 'COMPLETED',
          },
        });

        return {
          id: bo.id,
          status: 'COMPLETED' as BuildStatus,
          computedUnitCost,
        };
      },
      { timeout: 15000 },
    );
  }

  // ── POST /build-orders/:id/cancel ────────────────────────────────────────────
  async cancel(id: string): Promise<{ id: string; status: BuildStatus }> {
    const bo = await this.loadForLifecycle(id);
    if (bo.status === 'COMPLETED') {
      throw new ConflictException(
        fieldError(
          'status',
          'Cannot cancel a completed build order',
          409,
          'Conflict',
        ),
      );
    }
    if (bo.status === 'CANCELLED') {
      throw new ConflictException(
        fieldError(
          'status',
          'Build order is already cancelled',
          409,
          'Conflict',
        ),
      );
    }

    const needsRelease = bo.status === 'PLANNED' || bo.status === 'IN_PROGRESS';
    const components = needsRelease
      ? await this.bom.bomDirectComponents(bo.bomId)
      : [];
    const qtyPlanned = toNum(bo.qtyPlanned);

    return this.prisma.$transaction(async (tx) => {
      if (needsRelease) {
        for (const c of components) {
          const plannedRequired = qtyPlanned * c.perUnit;
          if (plannedRequired <= 0) continue;
          await this.posting.release(tx, {
            stockItemId: c.stockItemId,
            warehouseId: bo.warehouseId,
            qty: plannedRequired,
            refType: 'BUILD_ORDER',
            refId: bo.id,
          });
        }
      }

      await tx.buildOrder.update({
        where: { id: bo.id },
        data: { status: 'CANCELLED' },
      });

      return { id: bo.id, status: 'CANCELLED' as BuildStatus };
    });
  }
}
