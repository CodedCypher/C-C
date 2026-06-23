import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { normalizePaging } from '../common/pagination';
import { toNum, toISO } from '../common/money';

export interface OrdersResult {
  rows: {
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
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
          orderNumber: true,
          email: true,
          status: true,
          grandTotal: true,
          placedAt: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    const rows = rowsRaw.map((o) => ({
      orderNumber: o.orderNumber,
      customer: customerName(o.user, o.email),
      email: o.email,
      status: o.status,
      grandTotal: toNum(o.grandTotal),
      lineCount: o._count.lines,
      placedAt: toISO(o.placedAt ?? o.createdAt),
    }));

    return { rows, total, page, take };
  }
}
