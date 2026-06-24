import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** The signed-in customer's profile (User identity + CustomerProfile extras). */
export interface CustomerProfileInfo {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  marketingOptIn: boolean;
}

export interface MyOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  lineCount: number;
  placedAt: string | null;
}

export interface MyOrdersResult {
  rows: MyOrderRow[];
  total: number;
  page: number;
  take: number;
}

export interface MyOrderAddress {
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

export interface MyOrderLine {
  id: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface MyOrderPayment {
  status: string;
  methodName: string | null;
  amount: number;
  currency: string;
  reference: string | null;
  proofImageUrl: string | null;
  createdAt: string | null;
}

export interface MyOrderFulfillment {
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/**
 * Customer-safe order detail. Deliberately omits internal fields the admin view
 * carries (ship-from warehouse, per-line available stock, qtyFulfilled, admin
 * notes, billing snapshot).
 */
export interface MyOrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentType: string;
  currency: string;
  placedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  shipAddress: MyOrderAddress;
  totals: {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    shippingTotal: number;
    grandTotal: number;
  };
  lines: MyOrderLine[];
  payment: MyOrderPayment | null;
  fulfillment: MyOrderFulfillment | null;
}

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /me/profile ─────────────────────────────────────────────────────
  async getProfile(userId: string): Promise<CustomerProfileInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        customerProfile: {
          select: { phone: true, company: true, marketingOptIn: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.customerProfile?.phone ?? null,
      company: user.customerProfile?.company ?? null,
      marketingOptIn: user.customerProfile?.marketingOptIn ?? false,
    };
  }

  // ── PATCH /me/profile ───────────────────────────────────────────────────
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<CustomerProfileInfo> {
    await this.prisma.$transaction(async (tx) => {
      const userData: Prisma.UserUpdateInput = {};
      if (dto.firstName !== undefined)
        userData.firstName = dto.firstName ?? null;
      if (dto.lastName !== undefined) userData.lastName = dto.lastName ?? null;
      if (Object.keys(userData).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }

      const profileUpdate: Prisma.CustomerProfileUpdateInput = {};
      if (dto.phone !== undefined) profileUpdate.phone = dto.phone ?? null;
      if (dto.company !== undefined)
        profileUpdate.company = dto.company ?? null;
      if (dto.marketingOptIn !== undefined) {
        profileUpdate.marketingOptIn = dto.marketingOptIn;
      }

      await tx.customerProfile.upsert({
        where: { userId },
        create: {
          user: { connect: { id: userId } },
          phone: dto.phone ?? null,
          company: dto.company ?? null,
          marketingOptIn: dto.marketingOptIn ?? false,
        },
        update: profileUpdate,
      });
    });

    return this.getProfile(userId);
  }

  // ── GET /me/orders ──────────────────────────────────────────────────────
  async listOrders(
    userId: string,
    params: { page?: number; take?: number },
  ): Promise<MyOrdersResult> {
    const { page, take, skip } = normalizePaging(params);
    const where: Prisma.OrderWhereInput = { userId };

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
          status: true,
          grandTotal: true,
          placedAt: true,
          createdAt: true,
          _count: { select: { lines: true } },
        },
      }),
    ]);

    const rows = rowsRaw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      grandTotal: toNum(o.grandTotal),
      lineCount: o._count.lines,
      placedAt: toISO(o.placedAt ?? o.createdAt),
    }));

    return { rows, total, page, take };
  }

  // ── GET /me/orders/:id ──────────────────────────────────────────────────
  async order(userId: string, id: string): Promise<MyOrderDetail> {
    const o = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        lines: { orderBy: { id: 'asc' } },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { paymentMethod: { select: { name: true } } },
        },
        fulfillments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!o) throw new NotFoundException('Order not found');

    const payment = o.payments[0] ?? null;
    const fulfillment = o.fulfillments[0] ?? null;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      fulfillmentType: o.fulfillmentType,
      currency: o.currency,
      placedAt: toISO(o.placedAt),
      confirmedAt: toISO(o.confirmedAt),
      cancelledAt: toISO(o.cancelledAt),
      createdAt: toISO(o.createdAt),
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
      })),
      payment: payment
        ? {
            status: payment.status,
            methodName: payment.paymentMethod?.name ?? null,
            amount: toNum(payment.amount),
            currency: payment.currency,
            reference: payment.reference,
            proofImageUrl: payment.proofImageUrl,
            createdAt: toISO(payment.createdAt),
          }
        : null,
      fulfillment: fulfillment
        ? {
            status: fulfillment.status,
            carrier: fulfillment.carrier,
            trackingNumber: fulfillment.trackingNumber,
            shippedAt: toISO(fulfillment.shippedAt),
            deliveredAt: toISO(fulfillment.deliveredAt),
          }
        : null,
    };
  }
}
