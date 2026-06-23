import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../generated/prisma/client';
import { toNum, toISO, ymd, deltaPct } from '../common/money';

export interface DashboardMetrics {
  kpis: {
    revenue: number;
    revenueDeltaPct: number;
    orders: number;
    ordersDeltaPct: number;
    aov: number;
    newCustomers: number;
    newCustomersDeltaPct: number;
    lowStockCount: number;
    openBuildOrders: number;
    openPurchaseOrders: number;
    pendingFulfillments: number;
  };
  revenueSeries: { date: string; revenue: number; orders: number }[];
  ordersByStatus: { status: string; count: number }[];
  lowStock: {
    name: string;
    sku: string;
    onHand: number;
    reserved: number;
    available: number;
    reorderPoint: number;
    uom: string;
  }[];
  topProducts: {
    title: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  }[];
  recentOrders: {
    orderNumber: string;
    customer: string;
    status: string;
    grandTotal: number;
    placedAt: string | null;
  }[];
}

const OPEN_BUILD_STATUSES = ['DRAFT', 'PLANNED', 'IN_PROGRESS'] as const;
const OPEN_PO_STATUSES = ['DRAFT', 'SENT', 'PARTIAL'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function customerName(
  u: { firstName: string | null; lastName: string | null } | null | undefined,
  email: string,
): string {
  if (u) {
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
  }
  return email;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /dashboard ───────────────────────────────────────────────────────────
  async metrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const start30 = new Date(now.getTime() - 30 * DAY_MS);
    const start60 = new Date(now.getTime() - 60 * DAY_MS);

    // Orders in the last 60 days (for current + prior window + revenue series).
    // We bucket by placedAt, falling back to createdAt.
    const windowOrders = await this.prisma.order.findMany({
      where: {
        OR: [
          { placedAt: { gte: start60 } },
          { AND: [{ placedAt: null }, { createdAt: { gte: start60 } }] },
        ],
      },
      select: { placedAt: true, createdAt: true, grandTotal: true },
    });

    let revCurrent = 0;
    let ordCurrent = 0;
    let revPrior = 0;
    let ordPrior = 0;
    const seriesMap = new Map<string, { revenue: number; orders: number }>();

    for (const o of windowOrders) {
      const when = o.placedAt ?? o.createdAt;
      const total = toNum(o.grandTotal);
      if (when >= start30) {
        revCurrent += total;
        ordCurrent += 1;
        const key = ymd(when);
        const bucket = seriesMap.get(key) ?? { revenue: 0, orders: 0 };
        bucket.revenue += total;
        bucket.orders += 1;
        seriesMap.set(key, bucket);
      } else if (when >= start60) {
        revPrior += total;
        ordPrior += 1;
      }
    }

    // zero-filled 30-day ascending series
    const revenueSeries: { date: string; revenue: number; orders: number }[] =
      [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      const key = ymd(d);
      const bucket = seriesMap.get(key);
      revenueSeries.push({
        date: key,
        revenue: bucket ? bucket.revenue : 0,
        orders: bucket ? bucket.orders : 0,
      });
    }

    // New customers (role CUSTOMER) in each window
    const [newCustomers, priorNewCustomers] = await Promise.all([
      this.prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { gte: start30 } },
      }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: start60, lt: start30 },
        },
      }),
    ]);

    // Open counts
    const [openBuildOrders, openPurchaseOrders, pendingFulfillments] =
      await Promise.all([
        this.prisma.buildOrder.count({
          where: { status: { in: [...OPEN_BUILD_STATUSES] } },
        }),
        this.prisma.purchaseOrder.count({
          where: { status: { in: [...OPEN_PO_STATUSES] } },
        }),
        this.prisma.fulfillment.count({ where: { status: 'PENDING' } }),
      ]);

    // Low stock: (onHand - reserved) <= reorderPoint, reorderPoint not null.
    // Fetch candidates (reorderPoint set) and compute in JS (Decimal math).
    const stockCandidates = await this.prisma.stockItem.findMany({
      where: { reorderPoint: { not: null } },
      select: {
        onHand: true,
        reserved: true,
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

    type LowRow = {
      name: string;
      sku: string;
      onHand: number;
      reserved: number;
      available: number;
      reorderPoint: number;
      uom: string;
      margin: number;
    };
    const lowRows: LowRow[] = [];
    for (const s of stockCandidates) {
      const onHand = toNum(s.onHand);
      const reserved = toNum(s.reserved);
      const reorderPoint = toNum(s.reorderPoint);
      const available = onHand - reserved;
      if (available <= reorderPoint) {
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
        lowRows.push({
          name,
          sku,
          onHand,
          reserved,
          available,
          reorderPoint,
          uom: s.unitOfMeasure,
          margin: available - reorderPoint,
        });
      }
    }
    const lowStockCount = lowRows.length;
    const lowStock = lowRows
      .sort((a, b) => a.margin - b.margin)
      .slice(0, 8)
      .map(({ margin: _margin, ...rest }) => rest);

    // Top products: top 6 variants by unitsSold (sum OrderLine.quantity).
    const topGroups = await this.prisma.orderLine.groupBy({
      by: ['variantId'],
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 6,
    });
    const topVariantIds = topGroups.map((g) => g.variantId);
    const topVariants = topVariantIds.length
      ? await this.prisma.variant.findMany({
          where: { id: { in: topVariantIds } },
          select: {
            id: true,
            sku: true,
            title: true,
            product: { select: { title: true } },
          },
        })
      : [];
    const variantById = new Map(topVariants.map((v) => [v.id, v]));
    const topProducts = topGroups.map((g) => {
      const v = variantById.get(g.variantId);
      const title = v
        ? [v.product?.title, v.title].filter(Boolean).join(' ').trim()
        : '';
      return {
        title,
        sku: v?.sku ?? '',
        unitsSold: g._sum.quantity ?? 0,
        revenue: toNum(g._sum.lineTotal),
      };
    });

    // Recent orders: latest 8 by placedAt (fallback createdAt) desc.
    const recentRaw = await this.prisma.order.findMany({
      take: 8,
      orderBy: [{ placedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        orderNumber: true,
        status: true,
        grandTotal: true,
        placedAt: true,
        createdAt: true,
        email: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const recentOrders = recentRaw.map((o) => ({
      orderNumber: o.orderNumber,
      customer: customerName(o.user, o.email),
      status: o.status,
      grandTotal: toNum(o.grandTotal),
      placedAt: toISO(o.placedAt ?? o.createdAt),
    }));

    // Orders by status: every enum value, count may be 0.
    const statusGroups = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const countByStatus = new Map(
      statusGroups.map((g) => [g.status as string, g._count._all]),
    );
    const ordersByStatus = Object.values(OrderStatus).map((status) => ({
      status,
      count: countByStatus.get(status) ?? 0,
    }));

    const aov = ordCurrent > 0 ? revCurrent / ordCurrent : 0;

    return {
      kpis: {
        revenue: revCurrent,
        revenueDeltaPct: deltaPct(revCurrent, revPrior),
        orders: ordCurrent,
        ordersDeltaPct: deltaPct(ordCurrent, ordPrior),
        aov,
        newCustomers,
        newCustomersDeltaPct: deltaPct(newCustomers, priorNewCustomers),
        lowStockCount,
        openBuildOrders,
        openPurchaseOrders,
        pendingFulfillments,
      },
      revenueSeries,
      ordersByStatus,
      lowStock,
      topProducts,
      recentOrders,
    };
  }
}
