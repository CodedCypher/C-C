import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryPostingService } from '../common/inventory/inventory-posting.service';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { fieldError } from '../common/structured-error';
import { ShipOrderDto } from './dto/ship-order.dto';

export interface OrdersResult {
  rows: {
    id: string;
    orderNumber: string;
    customer: string;
    email: string;
    status: string;
    grandTotal: number;
    lineCount: number;
    placedAt: string | null;
  }[];
  total: number;
  page: number;
  take: number;
}

export interface OrderAddress {
  name: string | null;
  line1: string | null;
  line2: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  postal: string | null;
  country: string | null;
  phone: string | null;
}

export interface OrderLineInfo {
  id: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  qtyFulfilled: number;
  /** available (onHand - reserved) at the resolved ship-from warehouse; null when untracked. */
  available: number | null;
}

export interface PaymentInfo {
  id: string;
  provider: string;
  methodName: string | null;
  status: string;
  amount: number;
  currency: string;
  proofImageUrl: string | null;
  reference: string | null;
  capturedAt: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
}

export interface WarehouseRef {
  id: string;
  code: string;
  name: string;
}

export interface FulfillmentInfo {
  id: string;
  status: string;
  warehouse: WarehouseRef;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  channel: string;
  fulfillmentType: string;
  email: string;
  currency: string;
  notes: string | null;
  placedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  customer: { name: string; email: string; phone: string | null };
  branch: { id: string; name: string } | null;
  shipAddress: OrderAddress;
  billAddress: OrderAddress;
  totals: {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    shippingTotal: number;
    grandTotal: number;
  };
  lines: OrderLineInfo[];
  payment: PaymentInfo | null;
  fulfillment: FulfillmentInfo | null;
  shipFromWarehouse: WarehouseRef | null;
}

export interface OrderActionResult {
  id: string;
  status: OrderStatus;
}

function customerName(
  u: { firstName: string | null; lastName: string | null } | null | undefined,
  shipName: string | null,
  email: string,
): string {
  if (u) {
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
  }
  return shipName?.trim() || email;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: InventoryPostingService,
  ) {}

  // ── GET /orders ──────────────────────────────────────────────────────────────
  async orders(params: {
    status?: string;
    q?: string;
    page?: number;
    take?: number;
  }): Promise<OrdersResult> {
    const { page, take, skip } = normalizePaging(params);

    const where: Prisma.OrderWhereInput = {};
    if (params.status && params.status in OrderStatus) {
      where.status = params.status as OrderStatus;
    }
    if (params.q) {
      where.OR = [
        { orderNumber: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [total, rowsRaw] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: [{ placedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          orderNumber: true,
          email: true,
          status: true,
          grandTotal: true,
          placedAt: true,
          createdAt: true,
          shipName: true,
          user: { select: { firstName: true, lastName: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    const rows = rowsRaw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: customerName(o.user, o.shipName, o.email),
      email: o.email,
      status: o.status,
      grandTotal: toNum(o.grandTotal),
      lineCount: o._count.lines,
      placedAt: toISO(o.placedAt ?? o.createdAt),
    }));

    return { rows, total, page, take };
  }

  // ── GET /orders/:id ───────────────────────────────────────────────────────────
  async order(id: string): Promise<OrderDetail> {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            customerProfile: { select: { phone: true } },
          },
        },
        branch: { select: { id: true, name: true } },
        lines: {
          orderBy: { id: 'asc' },
          include: {
            variant: { select: { stockItem: { select: { id: true } } } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { paymentMethod: { select: { name: true } } },
        },
        fulfillments: {
          orderBy: { createdAt: 'desc' },
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!o) throw new NotFoundException(`Order ${id} not found`);

    const shipFromWarehouseId = await this.resolveShipFromWarehouseId(o, false);
    const shipFromWarehouse = shipFromWarehouseId
      ? await this.prisma.warehouse.findUnique({
          where: { id: shipFromWarehouseId },
          select: { id: true, code: true, name: true },
        })
      : null;

    // Available (onHand - reserved) per line at the resolved warehouse.
    const stockItemIds = o.lines
      .map((l) => l.variant.stockItem?.id)
      .filter((x): x is string => Boolean(x));
    const availMap = new Map<string, number>();
    if (shipFromWarehouseId && stockItemIds.length > 0) {
      const wsis = await this.prisma.warehouseStockItem.findMany({
        where: {
          warehouseId: shipFromWarehouseId,
          stockItemId: { in: stockItemIds },
        },
        select: { stockItemId: true, onHand: true, reserved: true },
      });
      for (const w of wsis) {
        availMap.set(w.stockItemId, toNum(w.onHand) - toNum(w.reserved));
      }
    }

    const latestPayment = o.payments[0] ?? null;
    const latestFulfillment = o.fulfillments[0] ?? null;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      channel: o.channel,
      fulfillmentType: o.fulfillmentType,
      email: o.email,
      currency: o.currency,
      notes: o.notes,
      placedAt: toISO(o.placedAt),
      confirmedAt: toISO(o.confirmedAt),
      cancelledAt: toISO(o.cancelledAt),
      createdAt: toISO(o.createdAt),
      customer: {
        name: customerName(o.user, o.shipName, o.email),
        email: o.email,
        phone: o.user?.customerProfile?.phone ?? o.shipPhone ?? null,
      },
      branch: o.branch ? { id: o.branch.id, name: o.branch.name } : null,
      shipAddress: {
        name: o.shipName,
        line1: o.shipLine1,
        line2: o.shipLine2,
        barangay: o.shipBarangay,
        city: o.shipCity,
        province: o.shipProvince,
        region: o.shipRegion,
        postal: o.shipPostal,
        country: o.shipCountry,
        phone: o.shipPhone,
      },
      billAddress: {
        name: o.billName,
        line1: o.billLine1,
        line2: o.billLine2,
        barangay: null,
        city: o.billCity,
        province: null,
        region: o.billRegion,
        postal: o.billPostal,
        country: o.billCountry,
        phone: o.billPhone,
      },
      totals: {
        subtotal: toNum(o.subtotal),
        discountTotal: toNum(o.discountTotal),
        taxTotal: toNum(o.taxTotal),
        shippingTotal: toNum(o.shippingTotal),
        grandTotal: toNum(o.grandTotal),
      },
      lines: o.lines.map((l) => ({
        id: l.id,
        sku: l.sku,
        title: l.title,
        quantity: l.quantity,
        unitPrice: toNum(l.unitPrice),
        lineTotal: toNum(l.lineTotal),
        qtyFulfilled: l.qtyFulfilled,
        available: l.variant.stockItem
          ? (availMap.get(l.variant.stockItem.id) ?? 0)
          : null,
      })),
      payment: latestPayment
        ? {
            id: latestPayment.id,
            provider: latestPayment.provider,
            methodName: latestPayment.paymentMethod?.name ?? null,
            status: latestPayment.status,
            amount: toNum(latestPayment.amount),
            currency: latestPayment.currency,
            proofImageUrl: latestPayment.proofImageUrl,
            reference: latestPayment.reference,
            capturedAt: toISO(latestPayment.capturedAt),
            verifiedAt: toISO(latestPayment.verifiedAt),
            createdAt: toISO(latestPayment.createdAt),
          }
        : null,
      fulfillment: latestFulfillment
        ? {
            id: latestFulfillment.id,
            status: latestFulfillment.status,
            warehouse: latestFulfillment.warehouse,
            carrier: latestFulfillment.carrier,
            trackingNumber: latestFulfillment.trackingNumber,
            shippedAt: toISO(latestFulfillment.shippedAt),
            deliveredAt: toISO(latestFulfillment.deliveredAt),
          }
        : null,
      shipFromWarehouse,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /**
   * Resolve the default ship-from warehouse for an order: a POS order ships from
   * its branch's default warehouse, a WEB order from the global `isDefaultWeb`
   * warehouse. When `required` and none can be resolved, throw a structured 400.
   */
  private async resolveShipFromWarehouseId(
    order: { branchId: string | null },
    required: true,
  ): Promise<string>;
  private async resolveShipFromWarehouseId(
    order: { branchId: string | null },
    required: false,
  ): Promise<string | null>;
  private async resolveShipFromWarehouseId(
    order: { branchId: string | null },
    required = true,
  ): Promise<string | null> {
    if (order.branchId) {
      const bw =
        (await this.prisma.branchWarehouse.findFirst({
          where: { branchId: order.branchId, isDefault: true },
          select: { warehouseId: true },
        })) ??
        (await this.prisma.branchWarehouse.findFirst({
          where: { branchId: order.branchId },
          orderBy: { priority: 'asc' },
          select: { warehouseId: true },
        }));
      if (bw) return bw.warehouseId;
    }
    const web = await this.prisma.warehouse.findFirst({
      where: { isDefaultWeb: true },
      select: { id: true },
    });
    if (web) return web.id;

    if (required) {
      throw new BadRequestException(
        fieldError(
          'warehouse',
          'No default fulfilment warehouse configured. Set a default web warehouse or a branch warehouse.',
          400,
          'ValidationError',
        ),
      );
    }
    return null;
  }

  /** Resolve (or lazily create) the StockItem id for a variant inside a tx. */
  private async ensureStockItemId(
    tx: Prisma.TransactionClient,
    variantId: string,
  ): Promise<string> {
    const si = await tx.stockItem.findUnique({
      where: { variantId },
      select: { id: true },
    });
    if (si) return si.id;
    const created = await tx.stockItem.create({
      data: {
        kind: 'VARIANT',
        variantId,
        unitOfMeasure: 'EACH',
        onHand: '0',
        reserved: '0',
        incoming: '0',
      },
      select: { id: true },
    });
    return created.id;
  }

  private async loadForLifecycle(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        lines: { select: { id: true, variantId: true, quantity: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        fulfillments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!o) throw new NotFoundException(`Order ${id} not found`);
    return o;
  }

  // ── POST /orders/:id/payment-proof ─────────────────────────────────────────────
  async uploadPaymentProof(
    id: string,
    proofImageUrl: string,
    reference?: string,
  ): Promise<PaymentInfo> {
    const o = await this.loadForLifecycle(id);
    if (o.status !== 'PENDING') {
      throw new ConflictException(
        fieldError(
          'status',
          `Payment proof can only be added while the order is pending (current: ${o.status})`,
          409,
          'Conflict',
        ),
      );
    }

    // Update the latest non-captured payment, else create a new manual one.
    const reusable = o.payments.find((p) => p.status !== 'CAPTURED');
    const payment = reusable
      ? await this.prisma.payment.update({
          where: { id: reusable.id },
          data: {
            provider: 'MANUAL',
            status: 'PENDING',
            proofImageUrl,
            reference: reference ?? null,
            failureReason: null,
          },
          include: { paymentMethod: { select: { name: true } } },
        })
      : await this.prisma.payment.create({
          data: {
            orderId: o.id,
            provider: 'MANUAL',
            status: 'PENDING',
            amount: o.grandTotal,
            currency: o.currency,
            proofImageUrl,
            reference: reference ?? null,
          },
          include: { paymentMethod: { select: { name: true } } },
        });

    return {
      id: payment.id,
      provider: payment.provider,
      methodName: payment.paymentMethod?.name ?? null,
      status: payment.status,
      amount: toNum(payment.amount),
      currency: payment.currency,
      proofImageUrl: payment.proofImageUrl,
      reference: payment.reference,
      capturedAt: toISO(payment.capturedAt),
      verifiedAt: toISO(payment.verifiedAt),
      createdAt: toISO(payment.createdAt),
    };
  }

  // ── POST /orders/:id/verify-payment ────────────────────────────────────────────
  async verifyPayment(id: string): Promise<OrderActionResult> {
    const o = await this.loadForLifecycle(id);
    if (o.status !== 'PENDING') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot verify payment for an order in status ${o.status}`,
          409,
          'Conflict',
        ),
      );
    }
    const proof = o.payments.find(
      (p) => p.proofImageUrl && p.status === 'PENDING',
    );
    if (!proof) {
      throw new ConflictException(
        fieldError(
          'payment',
          'Upload a payment proof before verifying.',
          409,
          'Conflict',
        ),
      );
    }

    const warehouseId = await this.resolveShipFromWarehouseId(o, true);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.payment.update({
        where: { id: proof.id },
        data: { status: 'CAPTURED', capturedAt: now, verifiedAt: now },
      });

      // Reserve stock for every line at the resolved warehouse.
      for (let i = 0; i < o.lines.length; i++) {
        const l = o.lines[i];
        if (l.quantity <= 0) continue;
        const stockItemId = await this.ensureStockItemId(tx, l.variantId);
        await this.posting.reserve(tx, {
          stockItemId,
          warehouseId,
          qty: l.quantity,
          refType: 'ORDER',
          refId: o.id,
        });
      }

      await tx.order.update({
        where: { id: o.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: o.confirmedAt ?? now,
        },
      });

      return { id: o.id, status: 'CONFIRMED' as OrderStatus };
    });
  }

  // ── POST /orders/:id/reject-payment ────────────────────────────────────────────
  async rejectPayment(id: string, reason?: string): Promise<OrderActionResult> {
    const o = await this.loadForLifecycle(id);
    if (o.status !== 'PENDING') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot reject payment for an order in status ${o.status}`,
          409,
          'Conflict',
        ),
      );
    }
    const proof = o.payments.find(
      (p) => p.proofImageUrl && p.status === 'PENDING',
    );
    if (!proof) {
      throw new ConflictException(
        fieldError(
          'payment',
          'There is no pending payment proof to reject.',
          409,
          'Conflict',
        ),
      );
    }
    await this.prisma.payment.update({
      where: { id: proof.id },
      data: {
        status: 'FAILED',
        failureReason: reason?.trim() || 'Proof rejected by admin',
      },
    });
    return { id: o.id, status: 'PENDING' as OrderStatus };
  }

  // ── POST /orders/:id/ship ──────────────────────────────────────────────────────
  async ship(id: string, dto: ShipOrderDto): Promise<OrderActionResult> {
    const o = await this.loadForLifecycle(id);
    if (o.status !== 'CONFIRMED') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot ship an order in status ${o.status}`,
          409,
          'Conflict',
        ),
      );
    }

    // Stock was reserved at the resolved default warehouse on verify; the admin
    // may override the ship-from warehouse. Release at the reserved one, deduct
    // (SALE) at the ship one.
    const reservedWarehouseId = await this.resolveShipFromWarehouseId(o, true);
    const shipWarehouseId = dto.warehouseId ?? reservedWarehouseId;

    const shipWh = await this.prisma.warehouse.findUnique({
      where: { id: shipWarehouseId },
      select: { id: true },
    });
    if (!shipWh) {
      throw new BadRequestException(
        fieldError(
          'warehouseId',
          'Ship-from warehouse not found.',
          400,
          'ValidationError',
        ),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const fulfillment = await tx.fulfillment.create({
        data: {
          orderId: o.id,
          warehouseId: shipWarehouseId,
          status: 'SHIPPED',
          carrier: dto.carrier ?? null,
          trackingNumber: dto.trackingNumber ?? null,
          shippedAt: new Date(),
        },
        select: { id: true },
      });

      for (let i = 0; i < o.lines.length; i++) {
        const l = o.lines[i];
        if (l.quantity <= 0) continue;
        const stockItemId = await this.ensureStockItemId(tx, l.variantId);

        // Release the reservation made on verify.
        await this.posting.release(tx, {
          stockItemId,
          warehouseId: reservedWarehouseId,
          qty: l.quantity,
          refType: 'ORDER',
          refId: o.id,
        });

        // Deduct physical stock from the ship-from warehouse.
        await this.posting.assertAvailable(
          tx,
          stockItemId,
          shipWarehouseId,
          l.quantity,
          `lines.${i}`,
        );
        await this.posting.postMovement(tx, {
          stockItemId,
          warehouseId: shipWarehouseId,
          qtyDelta: -l.quantity,
          reason: 'SALE',
          refType: 'FULFILLMENT',
          refId: fulfillment.id,
          field: `lines.${i}`,
        });

        await tx.fulfillmentLine.create({
          data: {
            fulfillmentId: fulfillment.id,
            orderLineId: l.id,
            stockItemId,
            warehouseId: shipWarehouseId,
            quantity: l.quantity,
          },
        });
        await tx.orderLine.update({
          where: { id: l.id },
          data: { qtyFulfilled: l.quantity },
        });
      }

      await tx.order.update({
        where: { id: o.id },
        data: { status: 'FULFILLED' },
      });

      return { id: o.id, status: 'FULFILLED' as OrderStatus };
    });
  }

  // ── POST /orders/:id/deliver ───────────────────────────────────────────────────
  async deliver(id: string): Promise<OrderActionResult> {
    const o = await this.loadForLifecycle(id);
    if (o.status !== 'FULFILLED' && o.status !== 'PARTIALLY_FULFILLED') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot mark delivered an order in status ${o.status}`,
          409,
          'Conflict',
        ),
      );
    }
    const fulfillment = o.fulfillments[0];
    return this.prisma.$transaction(async (tx) => {
      if (fulfillment) {
        await tx.fulfillment.update({
          where: { id: fulfillment.id },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        });
      }
      await tx.order.update({
        where: { id: o.id },
        data: { status: 'COMPLETED' },
      });
      return { id: o.id, status: 'COMPLETED' as OrderStatus };
    });
  }

  // ── POST /orders/:id/cancel ────────────────────────────────────────────────────
  async cancel(id: string): Promise<OrderActionResult> {
    const o = await this.loadForLifecycle(id);
    if (o.status !== 'PENDING' && o.status !== 'CONFIRMED') {
      throw new ConflictException(
        fieldError(
          'status',
          `Cannot cancel an order in status ${o.status}. Only pending or confirmed orders can be cancelled.`,
          409,
          'Conflict',
        ),
      );
    }

    const wasConfirmed = o.status === 'CONFIRMED';
    const reservedWarehouseId = wasConfirmed
      ? await this.resolveShipFromWarehouseId(o, true)
      : null;

    return this.prisma.$transaction(async (tx) => {
      // Release reservations taken on verify (CONFIRMED only).
      if (wasConfirmed && reservedWarehouseId) {
        for (const l of o.lines) {
          if (l.quantity <= 0) continue;
          const stockItemId = await this.ensureStockItemId(tx, l.variantId);
          await this.posting.release(tx, {
            stockItemId,
            warehouseId: reservedWarehouseId,
            qty: l.quantity,
            refType: 'ORDER',
            refId: o.id,
          });
        }
      }
      await tx.order.update({
        where: { id: o.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      return { id: o.id, status: 'CANCELLED' as OrderStatus };
    });
  }
}
