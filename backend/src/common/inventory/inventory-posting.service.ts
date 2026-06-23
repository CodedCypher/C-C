import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  MovementReason,
  MovementRefType,
} from '../../generated/prisma/client';
import { fieldError } from '../structured-error';

/**
 * circuit.rocks — the single transactional stock-posting path.
 *
 * Keystone invariant (schema header): for a given (stockItemId, warehouseId),
 * `WarehouseStockItem.onHand == Σ StockMovement.qtyDelta` over PHYSICAL reasons,
 * and `StockItem.{onHand,reserved,incoming}` are rollups = Σ across all of that
 * item's WarehouseStockItem rows. Every stock change in the app routes through
 * here so those invariants always hold.
 *
 * Reason buckets:
 *   physical (onHand) — RECEIPT, SALE, BUILD_CONSUME, BUILD_PRODUCE,
 *                       TRANSFER_OUT, TRANSFER_IN, ADJUST, RETURN, SCRAP
 *   reservation       — RESERVE / RELEASE (move `reserved`, never `onHand`;
 *                       excluded from the physical onHand sum)
 *   incoming          — open PO + inbound transfers in transit. NOT a physical
 *                       movement, so `adjustIncoming` moves the bucket without
 *                       writing a StockMovement.
 *
 * All methods take a `Prisma.TransactionClient`; callers wrap a unit of work in
 * `prisma.$transaction(async (tx) => …)` and pass `tx` so the movement, the
 * bucket update, and the rollup commit atomically.
 */

export interface PostMovementInput {
  stockItemId: string;
  warehouseId: string;
  /** Signed. RESERVE expects +qty, RELEASE expects -qty. */
  qtyDelta: number;
  reason: MovementReason;
  refType?: MovementRefType | null;
  refId?: string | null;
  unitCostAtMove?: number | null;
  note?: string | null;
  createdById?: string | null;
  /** Allow a physical move to drive onHand below zero (default false). */
  allowNegative?: boolean;
  /** Field path used in the structured 409 when a guard trips. */
  field?: string;
}

const RESERVATION_REASONS = new Set<MovementReason>(['RESERVE', 'RELEASE']);

// Format a JS number as a 4dp decimal string (matches @db.Decimal(14,4)) so we
// never write float drift into Postgres.
const q = (n: number): string => n.toFixed(4);

@Injectable()
export class InventoryPostingService {
  /**
   * Post one stock movement: writes the immutable ledger row, moves the
   * per-warehouse bucket (onHand for physical reasons, reserved for
   * RESERVE/RELEASE), then recomputes the StockItem rollup. Returns the
   * recomputed per-warehouse buckets.
   */
  async postMovement(
    tx: Prisma.TransactionClient,
    input: PostMovementInput,
  ): Promise<{ onHand: number; reserved: number; incoming: number }> {
    const {
      stockItemId,
      warehouseId,
      qtyDelta,
      reason,
      refType = null,
      refId = null,
      unitCostAtMove = null,
      note = null,
      createdById = null,
      allowNegative = false,
      field = 'quantity',
    } = input;

    const isReservation = RESERVATION_REASONS.has(reason);

    // Guard against driving physical on-hand negative.
    if (!isReservation && !allowNegative && qtyDelta < 0) {
      const existing = await tx.warehouseStockItem.findUnique({
        where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
        select: { onHand: true },
      });
      const current = existing ? Number(existing.onHand) : 0;
      if (current + qtyDelta < -1e-9) {
        throw new ConflictException(
          fieldError(
            field,
            `Insufficient on-hand stock: cannot move ${qtyDelta}, only ${current} on hand`,
            409,
            'Conflict',
          ),
        );
      }
    }

    // 1. Immutable ledger row.
    await tx.stockMovement.create({
      data: {
        stockItemId,
        warehouseId,
        qtyDelta: q(qtyDelta),
        reason,
        refType,
        refId,
        unitCostAtMove: unitCostAtMove === null ? null : q(unitCostAtMove),
        note,
        createdById,
      },
    });

    // 2. Move the per-warehouse bucket.
    if (isReservation) {
      await tx.warehouseStockItem.upsert({
        where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
        create: {
          stockItemId,
          warehouseId,
          onHand: '0',
          reserved: q(qtyDelta),
          incoming: '0',
        },
        update: { reserved: { increment: q(qtyDelta) } },
      });
    } else {
      await tx.warehouseStockItem.upsert({
        where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
        create: {
          stockItemId,
          warehouseId,
          onHand: q(qtyDelta),
          reserved: '0',
          incoming: '0',
        },
        update: { onHand: { increment: q(qtyDelta) } },
      });
    }

    // 3. Roll up to the StockItem.
    return this.recomputeRollup(tx, stockItemId);
  }

  /** Reserve `qty` at a warehouse (raises `reserved`, available drops). */
  reserve(
    tx: Prisma.TransactionClient,
    args: {
      stockItemId: string;
      warehouseId: string;
      qty: number;
      refType?: MovementRefType | null;
      refId?: string | null;
      note?: string | null;
      createdById?: string | null;
    },
  ) {
    return this.postMovement(tx, {
      ...args,
      qtyDelta: Math.abs(args.qty),
      reason: 'RESERVE',
    });
  }

  /** Release a prior reservation (lowers `reserved`). */
  release(
    tx: Prisma.TransactionClient,
    args: {
      stockItemId: string;
      warehouseId: string;
      qty: number;
      refType?: MovementRefType | null;
      refId?: string | null;
      note?: string | null;
      createdById?: string | null;
    },
  ) {
    return this.postMovement(tx, {
      ...args,
      qtyDelta: -Math.abs(args.qty),
      reason: 'RELEASE',
    });
  }

  /**
   * Move the `incoming` planning bucket (open PO / inbound transfer in transit).
   * Not a physical movement — no StockMovement row, just the bucket + rollup.
   */
  async adjustIncoming(
    tx: Prisma.TransactionClient,
    stockItemId: string,
    warehouseId: string,
    delta: number,
  ) {
    await tx.warehouseStockItem.upsert({
      where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
      create: {
        stockItemId,
        warehouseId,
        onHand: '0',
        reserved: '0',
        incoming: q(delta),
      },
      update: { incoming: { increment: q(delta) } },
    });
    return this.recomputeRollup(tx, stockItemId);
  }

  /**
   * Throw a structured 409 unless `qty` is available (onHand - reserved) at the
   * warehouse. Call before ship / consume / fulfil.
   */
  async assertAvailable(
    tx: Prisma.TransactionClient,
    stockItemId: string,
    warehouseId: string,
    qty: number,
    field = 'quantity',
  ): Promise<void> {
    const wsi = await tx.warehouseStockItem.findUnique({
      where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
      select: { onHand: true, reserved: true },
    });
    const available = wsi ? Number(wsi.onHand) - Number(wsi.reserved) : 0;
    if (available + 1e-9 < qty) {
      throw new ConflictException(
        fieldError(
          field,
          `Insufficient available stock: need ${qty}, have ${available}`,
          409,
          'Conflict',
        ),
      );
    }
  }

  /** Recompute StockItem.{onHand,reserved,incoming} = Σ across its warehouses. */
  async recomputeRollup(
    tx: Prisma.TransactionClient,
    stockItemId: string,
  ): Promise<{ onHand: number; reserved: number; incoming: number }> {
    const agg = await tx.warehouseStockItem.aggregate({
      where: { stockItemId },
      _sum: { onHand: true, reserved: true, incoming: true },
    });
    const onHand = agg._sum.onHand ?? new Prisma.Decimal(0);
    const reserved = agg._sum.reserved ?? new Prisma.Decimal(0);
    const incoming = agg._sum.incoming ?? new Prisma.Decimal(0);
    await tx.stockItem.update({
      where: { id: stockItemId },
      data: { onHand, reserved, incoming },
    });
    return {
      onHand: Number(onHand),
      reserved: Number(reserved),
      incoming: Number(incoming),
    };
  }
}
