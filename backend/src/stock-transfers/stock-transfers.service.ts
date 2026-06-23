import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryPostingService } from '../common/inventory/inventory-posting.service';
import { Prisma, TransferStatus } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { fieldError } from '../common/structured-error';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';

export interface TransfersResult {
  rows: {
    id: string;
    transferNumber: string;
    sourceWarehouse: { code: string; name: string };
    destWarehouse: { code: string; name: string };
    status: TransferStatus;
    lineCount: number;
    createdAt: string | null;
    shippedAt: string | null;
    receivedAt: string | null;
  }[];
  total: number;
  page: number;
  take: number;
}

export interface TransferDetail {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  notes: string | null;
  sourceWarehouse: { id: string; code: string; name: string };
  destWarehouse: { id: string; code: string; name: string };
  shippedAt: string | null;
  receivedAt: string | null;
  createdAt: string | null;
  lines: {
    id: string;
    stockItemId: string;
    name: string;
    sku: string;
    uom: string;
    quantity: number;
    qtyShipped: number;
    qtyReceived: number;
  }[];
}

export interface CreateTransferResult {
  id: string;
  transferNumber: string;
}

// stockItem.select used wherever we need to resolve a line's display name/sku/uom.
const STOCK_ITEM_LABEL_SELECT = {
  unitOfMeasure: true,
  variant: { select: { sku: true, title: true, product: { select: { title: true } } } },
  rawMaterial: { select: { sku: true, name: true } },
} satisfies Prisma.StockItemSelect;

type StockItemLabel = Prisma.StockItemGetPayload<{
  select: typeof STOCK_ITEM_LABEL_SELECT;
}>;

// Resolve { name, sku, uom } for a stock item from its variant or raw material.
function labelFor(item: StockItemLabel): {
  name: string;
  sku: string;
  uom: string;
} {
  const uom = item.unitOfMeasure as string;
  if (item.variant) {
    const productTitle = item.variant.product?.title ?? '';
    const variantTitle = item.variant.title;
    const name = variantTitle
      ? `${productTitle} — ${variantTitle}`.trim()
      : productTitle;
    return { name: name || item.variant.sku, sku: item.variant.sku, uom };
  }
  if (item.rawMaterial) {
    return { name: item.rawMaterial.name, sku: item.rawMaterial.sku, uom };
  }
  return { name: '', sku: '', uom };
}

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: InventoryPostingService,
  ) {}

  // ── GET /stock-transfers ───────────────────────────────────────────────────
  async transfers(params: {
    status?: string;
    q?: string;
    page?: number;
    take?: number;
  }): Promise<TransfersResult> {
    const { page, take, skip } = normalizePaging(params);

    const where: Prisma.StockTransferWhereInput = {};
    if (params.status && params.status in TransferStatus) {
      where.status = params.status as TransferStatus;
    }
    if (params.q) {
      where.transferNumber = { contains: params.q, mode: 'insensitive' };
    }

    const [total, rowsRaw] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transferNumber: true,
          status: true,
          createdAt: true,
          shippedAt: true,
          receivedAt: true,
          sourceWarehouse: { select: { code: true, name: true } },
          destWarehouse: { select: { code: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    const rows = rowsRaw.map((t) => ({
      id: t.id,
      transferNumber: t.transferNumber,
      sourceWarehouse: {
        code: t.sourceWarehouse.code,
        name: t.sourceWarehouse.name,
      },
      destWarehouse: {
        code: t.destWarehouse.code,
        name: t.destWarehouse.name,
      },
      status: t.status,
      lineCount: t._count.lines,
      createdAt: toISO(t.createdAt),
      shippedAt: toISO(t.shippedAt),
      receivedAt: toISO(t.receivedAt),
    }));

    return { rows, total, page, take };
  }

  // ── GET /stock-transfers/:id ───────────────────────────────────────────────
  async transfer(id: string): Promise<TransferDetail> {
    const t = await this.prisma.stockTransfer.findUnique({
      where: { id },
      select: {
        id: true,
        transferNumber: true,
        status: true,
        notes: true,
        createdAt: true,
        shippedAt: true,
        receivedAt: true,
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            stockItemId: true,
            quantity: true,
            qtyShipped: true,
            qtyReceived: true,
            stockItem: { select: STOCK_ITEM_LABEL_SELECT },
          },
        },
      },
    });

    if (!t) {
      throw new NotFoundException(
        fieldError('id', `Transfer "${id}" not found`, 404, 'NotFound'),
      );
    }

    return {
      id: t.id,
      transferNumber: t.transferNumber,
      status: t.status,
      notes: t.notes,
      sourceWarehouse: {
        id: t.sourceWarehouse.id,
        code: t.sourceWarehouse.code,
        name: t.sourceWarehouse.name,
      },
      destWarehouse: {
        id: t.destWarehouse.id,
        code: t.destWarehouse.code,
        name: t.destWarehouse.name,
      },
      shippedAt: toISO(t.shippedAt),
      receivedAt: toISO(t.receivedAt),
      createdAt: toISO(t.createdAt),
      lines: t.lines.map((l) => {
        const label = labelFor(l.stockItem);
        return {
          id: l.id,
          stockItemId: l.stockItemId,
          name: label.name,
          sku: label.sku,
          uom: label.uom,
          quantity: toNum(l.quantity),
          qtyShipped: toNum(l.qtyShipped),
          qtyReceived: toNum(l.qtyReceived),
        };
      }),
    };
  }

  // ── POST /stock-transfers ──────────────────────────────────────────────────
  async createTransfer(dto: CreateTransferDto): Promise<CreateTransferResult> {
    if (dto.sourceWarehouseId === dto.destWarehouseId) {
      throw new BadRequestException(
        fieldError(
          'destWarehouseId',
          'Source and destination warehouses must differ',
          400,
          'ValidationError',
        ),
      );
    }

    // Duplicate stock item within the payload.
    const seen = new Map<string, number>();
    for (let i = 0; i < dto.lines.length; i++) {
      const sid = dto.lines[i].stockItemId;
      if (seen.has(sid)) {
        throw new BadRequestException(
          fieldError(
            `lines.${i}.stockItemId`,
            `Duplicate stock item "${sid}" in payload`,
            400,
            'ValidationError',
          ),
        );
      }
      seen.set(sid, i);
    }

    // Generate a unique transferNumber; retry on the rare P2002 collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const transferNumber = `TRF-${randomBytes(4).toString('hex').toUpperCase()}`;
      try {
        const created = await this.prisma.stockTransfer.create({
          data: {
            transferNumber,
            sourceWarehouseId: dto.sourceWarehouseId,
            destWarehouseId: dto.destWarehouseId,
            status: 'DRAFT',
            notes: dto.notes ?? null,
            lines: {
              create: dto.lines.map((l) => ({
                stockItemId: l.stockItemId,
                quantity: l.quantity,
                qtyShipped: '0',
                qtyReceived: '0',
              })),
            },
          },
          select: { id: true, transferNumber: true },
        });
        return { id: created.id, transferNumber: created.transferNumber };
      } catch (e) {
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
          if (targets.includes('transferNumber')) {
            continue; // collision — regenerate and retry
          }
        }
        throw e;
      }
    }

    throw new ConflictException(
      fieldError(
        'transferNumber',
        'Could not allocate a unique transfer number, please retry',
        409,
        'Conflict',
      ),
    );
  }

  // ── PATCH /stock-transfers/:id ─────────────────────────────────────────────
  async updateTransfer(
    id: string,
    dto: UpdateTransferDto,
  ): Promise<CreateTransferResult> {
    // Duplicate stock item within the payload.
    const seen = new Map<string, number>();
    for (let i = 0; i < dto.lines.length; i++) {
      const sid = dto.lines[i].stockItemId;
      if (seen.has(sid)) {
        throw new BadRequestException(
          fieldError(
            `lines.${i}.stockItemId`,
            `Duplicate stock item "${sid}" in payload`,
            400,
            'ValidationError',
          ),
        );
      }
      seen.set(sid, i);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockTransfer.findUnique({
        where: { id },
        select: { id: true, status: true, transferNumber: true },
      });
      if (!existing) {
        throw new NotFoundException(
          fieldError('id', `Transfer "${id}" not found`, 404, 'NotFound'),
        );
      }
      if (existing.status !== 'DRAFT') {
        throw new ConflictException(
          fieldError(
            'status',
            `Only DRAFT transfers can be edited (current: ${existing.status})`,
            409,
            'Conflict',
          ),
        );
      }

      // Replace lines wholesale.
      await tx.stockTransferLine.deleteMany({ where: { stockTransferId: id } });
      await tx.stockTransfer.update({
        where: { id },
        data: {
          notes: dto.notes ?? null,
          lines: {
            create: dto.lines.map((l) => ({
              stockItemId: l.stockItemId,
              quantity: l.quantity,
              qtyShipped: '0',
              qtyReceived: '0',
            })),
          },
        },
      });

      return { id: existing.id, transferNumber: existing.transferNumber };
    });
  }

  // ── POST /stock-transfers/:id/request ──────────────────────────────────────
  async requestTransfer(id: string): Promise<{ id: string; status: TransferStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockTransfer.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException(
          fieldError('id', `Transfer "${id}" not found`, 404, 'NotFound'),
        );
      }
      if (existing.status !== 'DRAFT') {
        throw new ConflictException(
          fieldError(
            'status',
            `Only DRAFT transfers can be requested (current: ${existing.status})`,
            409,
            'Conflict',
          ),
        );
      }
      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'REQUESTED' },
      });
      return { id, status: 'REQUESTED' as TransferStatus };
    });
  }

  // ── POST /stock-transfers/:id/ship ─────────────────────────────────────────
  async shipTransfer(id: string): Promise<{ id: string; status: TransferStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          notes: true,
          sourceWarehouseId: true,
          destWarehouseId: true,
          lines: {
            orderBy: { id: 'asc' },
            select: { id: true, stockItemId: true, quantity: true },
          },
        },
      });
      if (!transfer) {
        throw new NotFoundException(
          fieldError('id', `Transfer "${id}" not found`, 404, 'NotFound'),
        );
      }
      if (transfer.status !== 'DRAFT' && transfer.status !== 'REQUESTED') {
        throw new ConflictException(
          fieldError(
            'status',
            `Only DRAFT or REQUESTED transfers can be shipped (current: ${transfer.status})`,
            409,
            'Conflict',
          ),
        );
      }

      for (let i = 0; i < transfer.lines.length; i++) {
        const line = transfer.lines[i];
        const qty = toNum(line.quantity);
        const field = `lines.${i}.quantity`;

        // Reserve-aware availability guard at the source warehouse.
        await this.posting.assertAvailable(
          tx,
          line.stockItemId,
          transfer.sourceWarehouseId,
          qty,
          field,
        );

        // Physical out at source.
        await this.posting.postMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: transfer.sourceWarehouseId,
          qtyDelta: -qty,
          reason: 'TRANSFER_OUT',
          refType: 'STOCK_TRANSFER',
          refId: transfer.id,
          note: transfer.notes,
          field,
        });

        // In-transit planning bucket at destination.
        await this.posting.adjustIncoming(
          tx,
          line.stockItemId,
          transfer.destWarehouseId,
          qty,
        );

        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { qtyShipped: qty.toFixed(4) },
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'IN_TRANSIT', shippedAt: new Date() },
      });

      return { id, status: 'IN_TRANSIT' as TransferStatus };
    });
  }

  // ── POST /stock-transfers/:id/receive ──────────────────────────────────────
  async receiveTransfer(
    id: string,
    dto: ReceiveTransferDto,
  ): Promise<{ id: string; status: TransferStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          destWarehouseId: true,
          lines: {
            select: {
              id: true,
              stockItemId: true,
              qtyShipped: true,
              qtyReceived: true,
            },
          },
        },
      });
      if (!transfer) {
        throw new NotFoundException(
          fieldError('id', `Transfer "${id}" not found`, 404, 'NotFound'),
        );
      }
      if (
        transfer.status !== 'IN_TRANSIT' &&
        transfer.status !== 'PARTIALLY_RECEIVED'
      ) {
        throw new ConflictException(
          fieldError(
            'status',
            `Only IN_TRANSIT or PARTIALLY_RECEIVED transfers can be received (current: ${transfer.status})`,
            409,
            'Conflict',
          ),
        );
      }

      const lineById = new Map(transfer.lines.map((l) => [l.id, l]));

      for (let i = 0; i < dto.lines.length; i++) {
        const input = dto.lines[i];
        const field = `lines.${i}.qtyReceived`;
        const line = lineById.get(input.lineId);
        if (!line) {
          throw new BadRequestException(
            fieldError(
              field,
              `Line "${input.lineId}" does not belong to this transfer`,
              400,
              'ValidationError',
            ),
          );
        }

        const recv = Number(input.qtyReceived);
        if (recv <= 0) continue;

        const remaining = toNum(line.qtyShipped) - toNum(line.qtyReceived);
        if (recv - 1e-9 > remaining) {
          throw new BadRequestException(
            fieldError(
              field,
              `qtyReceived ${recv} exceeds outstanding ${remaining} for this line`,
              400,
              'ValidationError',
            ),
          );
        }

        // Physical in at destination.
        await this.posting.postMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: transfer.destWarehouseId,
          qtyDelta: recv,
          reason: 'TRANSFER_IN',
          refType: 'STOCK_TRANSFER',
          refId: transfer.id,
          field,
        });

        // Drain the in-transit planning bucket as it lands.
        await this.posting.adjustIncoming(
          tx,
          line.stockItemId,
          transfer.destWarehouseId,
          -recv,
        );

        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { qtyReceived: { increment: recv.toFixed(4) } },
        });
      }

      // Re-read lines to decide final status.
      const after = await tx.stockTransferLine.findMany({
        where: { stockTransferId: id },
        select: { qtyShipped: true, qtyReceived: true },
      });
      const fullyReceived = after.every(
        (l) => toNum(l.qtyReceived) + 1e-9 >= toNum(l.qtyShipped),
      );

      if (fullyReceived) {
        await tx.stockTransfer.update({
          where: { id },
          data: { status: 'RECEIVED', receivedAt: new Date() },
        });
        return { id, status: 'RECEIVED' as TransferStatus };
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'PARTIALLY_RECEIVED' },
      });
      return { id, status: 'PARTIALLY_RECEIVED' as TransferStatus };
    });
  }

  // ── POST /stock-transfers/:id/cancel ───────────────────────────────────────
  async cancelTransfer(id: string): Promise<{ id: string; status: TransferStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          sourceWarehouseId: true,
          destWarehouseId: true,
          lines: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              stockItemId: true,
              qtyShipped: true,
              qtyReceived: true,
            },
          },
        },
      });
      if (!transfer) {
        throw new NotFoundException(
          fieldError('id', `Transfer "${id}" not found`, 404, 'NotFound'),
        );
      }
      if (
        transfer.status === 'RECEIVED' ||
        transfer.status === 'CANCELLED'
      ) {
        throw new ConflictException(
          fieldError(
            'status',
            `Cannot cancel a ${transfer.status} transfer`,
            409,
            'Conflict',
          ),
        );
      }

      // If shipped (IN_TRANSIT / PARTIALLY_RECEIVED), return the in-transit
      // remainder to the source warehouse and drain the destination incoming.
      if (
        transfer.status === 'IN_TRANSIT' ||
        transfer.status === 'PARTIALLY_RECEIVED'
      ) {
        for (const line of transfer.lines) {
          const rem = toNum(line.qtyShipped) - toNum(line.qtyReceived);
          if (rem <= 0) continue;

          await this.posting.postMovement(tx, {
            stockItemId: line.stockItemId,
            warehouseId: transfer.sourceWarehouseId,
            qtyDelta: rem,
            reason: 'TRANSFER_IN',
            refType: 'STOCK_TRANSFER',
            refId: transfer.id,
            note: 'transfer cancelled',
          });

          await this.posting.adjustIncoming(
            tx,
            line.stockItemId,
            transfer.destWarehouseId,
            -rem,
          );
        }
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return { id, status: 'CANCELLED' as TransferStatus };
    });
  }
}
