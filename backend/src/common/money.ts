import { Prisma } from '../generated/prisma/client';

// Money formats passed to Prisma as strings.
// 2dp for currency (price/compareAtPrice), 4dp for stock quantities (decimal 14,4).
export const MONEY_2 = /^\d{1,10}(\.\d{1,2})?$/;
export const MONEY_4 = /^\d{1,10}(\.\d{1,4})?$/;

export function toNum(x: Prisma.Decimal | number | null | undefined): number {
  if (x === null || x === undefined) return 0;
  return Number(x);
}

export function toISO(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function ymd(d: Date): string {
  // local-agnostic day bucket in UTC
  return d.toISOString().slice(0, 10);
}

export function deltaPct(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return ((current - prior) / prior) * 100;
}
