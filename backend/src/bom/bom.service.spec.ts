// The generated Prisma client ships `.js`-suffixed internal imports that Jest's
// default (CommonJS) resolver cannot map back to their `.ts` sources the way
// tsc's `nodenext` resolution does. The client is never exercised here (a stub
// stands in for PrismaService), so we replace the module wholesale to keep the
// import chain (BomService → PrismaService → generated/prisma/client) loadable.
jest.mock('../generated/prisma/client', () => ({
  // PrismaService `extends PrismaClient`, so it must be a constructable class.
  PrismaClient: class {},
  Prisma: {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { BomService } from './bom.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── In-memory fixture ─────────────────────────────────────────────────────────
//
// Two-level BOM:
//   bom-final (active, output variant si-final)
//     ├─ si-rawA  qty 2, scrap 0.05 (5%)            (raw material — leaf)
//     └─ si-sub   qty 3                              (BUILT sub-assembly)
//           bom-sub (active, output variant si-sub)
//             ├─ si-rawB  qty 4                      (raw material — leaf)
//             └─ si-rawA  qty 1                      (shared leaf — tests aggregation)
//
// Plus a deliberately cyclic fixture:
//   bom-cyc (active, output variant si-cyc) → consumes si-cyc2 (BUILT)
//   bom-cyc2 (active, output variant si-cyc2) → consumes si-cyc (BUILT) → CYCLE

interface FixtureLine {
  stockItemId: string;
  quantity: number;
  unit: string;
  scrapPct: number | null;
}
interface FixtureBom {
  id: string;
  variantId: string;
  isActive: boolean;
  lines: FixtureLine[];
}
interface FixtureStockItem {
  id: string;
  kind: 'VARIANT' | 'MATERIAL';
  variantId: string | null;
  unitOfMeasure: string;
  standardCost: number | null;
  // variant fields when kind === VARIANT
  sku?: string;
  title?: string | null;
  productTitle?: string;
  // raw material fields when kind === MATERIAL
  rawSku?: string;
  rawName?: string;
}

const STOCK_ITEMS: FixtureStockItem[] = [
  {
    id: 'si-final',
    kind: 'VARIANT',
    variantId: 'v-final',
    unitOfMeasure: 'EACH',
    standardCost: null,
    sku: 'FINAL-1',
    title: 'Final',
    productTitle: 'Widget',
  },
  {
    id: 'si-sub',
    kind: 'VARIANT',
    variantId: 'v-sub',
    unitOfMeasure: 'EACH',
    standardCost: 5,
    sku: 'SUB-1',
    title: 'Sub',
    productTitle: 'SubAssembly',
  },
  {
    id: 'si-rawA',
    kind: 'MATERIAL',
    variantId: null,
    unitOfMeasure: 'GRAM',
    standardCost: 2,
    rawSku: 'RAW-A',
    rawName: 'Raw A',
  },
  {
    id: 'si-rawB',
    kind: 'MATERIAL',
    variantId: null,
    unitOfMeasure: 'METER',
    standardCost: 3,
    rawSku: 'RAW-B',
    rawName: 'Raw B',
  },
  // cyclic fixture variants
  {
    id: 'si-cyc',
    kind: 'VARIANT',
    variantId: 'v-cyc',
    unitOfMeasure: 'EACH',
    standardCost: null,
    sku: 'CYC-1',
    title: 'Cyc',
    productTitle: 'Cyclic',
  },
  {
    id: 'si-cyc2',
    kind: 'VARIANT',
    variantId: 'v-cyc2',
    unitOfMeasure: 'EACH',
    standardCost: null,
    sku: 'CYC-2',
    title: 'Cyc2',
    productTitle: 'Cyclic2',
  },
];

const BOMS: FixtureBom[] = [
  {
    id: 'bom-final',
    variantId: 'v-final',
    isActive: true,
    lines: [
      { stockItemId: 'si-rawA', quantity: 2, unit: 'GRAM', scrapPct: 0.05 },
      { stockItemId: 'si-sub', quantity: 3, unit: 'EACH', scrapPct: null },
    ],
  },
  {
    id: 'bom-sub',
    variantId: 'v-sub',
    isActive: true,
    lines: [
      { stockItemId: 'si-rawB', quantity: 4, unit: 'METER', scrapPct: null },
      { stockItemId: 'si-rawA', quantity: 1, unit: 'GRAM', scrapPct: null },
    ],
  },
  {
    id: 'bom-cyc',
    variantId: 'v-cyc',
    isActive: true,
    lines: [
      { stockItemId: 'si-cyc2', quantity: 1, unit: 'EACH', scrapPct: null },
    ],
  },
  {
    id: 'bom-cyc2',
    variantId: 'v-cyc2',
    isActive: true,
    lines: [
      { stockItemId: 'si-cyc', quantity: 1, unit: 'EACH', scrapPct: null },
    ],
  },
];

// Build the minimal Prisma stub: only the methods explodeBom touches.
function makePrismaStub() {
  return {
    billOfMaterials: {
      findUnique: jest.fn(({ where, select }: any) => {
        const b = BOMS.find((x) => x.id === where.id);
        if (!b) return Promise.resolve(null);
        // explodeBom selects { id, variantId }
        return Promise.resolve({ id: b.id, variantId: b.variantId });
      }),
    },
    stockItem: {
      // explodeBom seeds the cycle path with the root variant's stock item.
      findUnique: jest.fn(({ where }: any) => {
        const si = STOCK_ITEMS.find((x) => x.variantId === where.variantId);
        return Promise.resolve(si ? { id: si.id } : null);
      }),
      // loadStockItemMeta selects relations including variant.boms (active).
      findMany: jest.fn(({ where }: any) => {
        const ids: string[] = where.id.in;
        const rows = STOCK_ITEMS.filter((s) => ids.includes(s.id)).map((s) => {
          if (s.kind === 'VARIANT') {
            const activeBom = BOMS.find(
              (b) => b.variantId === s.variantId && b.isActive,
            );
            return {
              id: s.id,
              kind: s.kind,
              unitOfMeasure: s.unitOfMeasure,
              standardCost: s.standardCost,
              variant: {
                sku: s.sku,
                title: s.title ?? null,
                product: { title: s.productTitle },
                boms: activeBom ? [{ id: activeBom.id }] : [],
              },
              rawMaterial: null,
            };
          }
          return {
            id: s.id,
            kind: s.kind,
            unitOfMeasure: s.unitOfMeasure,
            standardCost: s.standardCost,
            variant: null,
            rawMaterial: { sku: s.rawSku, name: s.rawName },
          };
        });
        return Promise.resolve(rows);
      }),
    },
    bomLine: {
      // loadResolvedLines selects { stockItemId, quantity, scrapPct }.
      findMany: jest.fn(({ where }: any) => {
        const b = BOMS.find((x) => x.id === where.bomId);
        const lines = b
          ? b.lines.map((l) => ({
              stockItemId: l.stockItemId,
              quantity: l.quantity,
              scrapPct: l.scrapPct,
            }))
          : [];
        return Promise.resolve(lines);
      }),
    },
  };
}

describe('BomService.explodeBom', () => {
  let service: BomService;

  beforeEach(async () => {
    const prismaStub = makePrismaStub();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [BomService, { provide: PrismaService, useValue: prismaStub }],
    }).compile();
    service = moduleRef.get(BomService);
  });

  it('aggregates leaf totals correctly across the tree with scrap', async () => {
    const result = await service.explodeBom('bom-final', 1);

    // Tree shape: 2 top-level nodes (rawA leaf, sub built w/ 2 children).
    expect(result.tree).toHaveLength(2);
    expect(result.maxDepth).toBe(1);

    const rawANode = result.tree.find((n) => n.stockItemId === 'si-rawA')!;
    // quantityPerParent = 2 * (1 + 0.05) = 2.1 ; extendedQty = 1 * 2.1 = 2.1
    expect(rawANode.quantityPerParent).toBeCloseTo(2.1, 6);
    expect(rawANode.extendedQty).toBeCloseTo(2.1, 6);
    expect(rawANode.isBuilt).toBe(false);

    const subNode = result.tree.find((n) => n.stockItemId === 'si-sub')!;
    expect(subNode.isBuilt).toBe(true);
    expect(subNode.extendedQty).toBeCloseTo(3, 6); // qty 3, no scrap
    expect(subNode.children).toHaveLength(2);

    // Leaf aggregation across the whole tree:
    //   si-rawA  = 2.1 (direct) + 3 (sub) * 1 (rawA in sub) = 5.1
    //   si-rawB  = 3 (sub) * 4 = 12
    const leafA = result.leaves.find((l) => l.stockItemId === 'si-rawA')!;
    const leafB = result.leaves.find((l) => l.stockItemId === 'si-rawB')!;
    expect(leafA.totalQty).toBeCloseTo(5.1, 6);
    expect(leafB.totalQty).toBeCloseTo(12, 6);
    // The built sub-assembly is NOT a leaf.
    expect(
      result.leaves.find((l) => l.stockItemId === 'si-sub'),
    ).toBeUndefined();
  });

  it('scales with the requested qty', async () => {
    const result = await service.explodeBom('bom-final', 10);
    const leafA = result.leaves.find((l) => l.stockItemId === 'si-rawA')!;
    const leafB = result.leaves.find((l) => l.stockItemId === 'si-rawB')!;
    expect(leafA.totalQty).toBeCloseTo(51, 6); // 5.1 * 10
    expect(leafB.totalQty).toBeCloseTo(120, 6); // 12 * 10
  });

  it('throws a 409 ConflictException on a cyclic BOM', async () => {
    await expect(service.explodeBom('bom-cyc', 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.explodeBom('bom-cyc', 1)).rejects.toMatchObject({
      response: { statusCode: 409, error: 'Conflict' },
    });
  });
});
