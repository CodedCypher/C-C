// The generated Prisma client ships `.js`-suffixed internal imports Jest's
// CommonJS resolver can't map to their `.ts` sources. The client is never
// exercised here (a stub stands in for PrismaService), so we replace the module
// wholesale to keep the import chain loadable.
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectKitsService } from './project-kits.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

// A purchasable, in-stock part: qty 1 @ ₱100, 10 on hand.
const inStockLine = {
  quantity: 1,
  unit: 'EACH',
  stockItem: {
    id: 'si-in',
    kind: 'VARIANT',
    unitOfMeasure: 'EACH',
    reorderPoint: null,
    warehouseStock: [{ onHand: 10, reserved: 0, reorderPoint: null }],
    variant: {
      id: 'v-in',
      sku: 'PART-IN',
      title: 'In-stock part',
      price: 100,
      isActive: true,
      deletedAt: null,
      product: { slug: 'part-in', status: 'ACTIVE', title: 'In-stock part', images: [] },
    },
  },
};

// An out-of-stock part: qty 5 @ ₱50, 0 on hand.
const oosLine = {
  quantity: 5,
  unit: 'EACH',
  stockItem: {
    id: 'si-oos',
    kind: 'VARIANT',
    unitOfMeasure: 'EACH',
    reorderPoint: null,
    warehouseStock: [{ onHand: 0, reserved: 0, reorderPoint: null }],
    variant: {
      id: 'v-oos',
      sku: 'PART-OOS',
      title: 'OOS part',
      price: 50,
      isActive: true,
      deletedAt: null,
      product: { slug: 'part-oos', status: 'ACTIVE', title: 'OOS part', images: [] },
    },
  },
};

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    variant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      ...(overrides.variant as object),
    },
    $transaction: jest.fn(),
    ...overrides,
  } as unknown as PrismaService;
}

async function build(prisma: PrismaService): Promise<ProjectKitsService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      ProjectKitsService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return moduleRef.get(ProjectKitsService);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectKitsService', () => {
  describe('list', () => {
    it('projects parts to live stock + parts-total', async () => {
      const prisma = makePrisma({
        variant: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'kit-1',
              sku: 'KIT-X',
              price: 999,
              kitPublished: true,
              kitPosition: 0,
              product: {
                title: 'Kit X',
                slug: 'kit-x',
                status: 'ACTIVE',
                images: [{ url: '/x.jpg' }],
              },
              boms: [{ lines: [inStockLine, oosLine] }],
            },
          ]),
        },
      });
      const svc = await build(prisma);
      const rows = await svc.list();

      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.id).toBe('kit-1');
      expect(row.partCount).toBe(2);
      expect(row.inStockCount).toBe(1);
      expect(row.allInStock).toBe(false);
      expect(row.partsTotal).toBe(100); // only the in-stock line counts
      expect(row.primaryImage).toBe('/x.jpg');
      expect(row.published).toBe(true);
    });
  });

  describe('setPublished', () => {
    it('refuses to publish a kit with no parts', async () => {
      const prisma = makePrisma({
        variant: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'kit-1', boms: [{ lines: [] }] }),
          update: jest.fn(),
        },
      });
      const svc = await build(prisma);
      await expect(svc.setPublished('kit-1', true)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect((prisma.variant.update as jest.Mock)).not.toHaveBeenCalled();
    });

    it('publishes a kit that has parts', async () => {
      const prisma = makePrisma({
        variant: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'kit-1', boms: [{ lines: [inStockLine] }] }),
          update: jest.fn().mockResolvedValue({}),
        },
      });
      const svc = await build(prisma);
      const res = await svc.setPublished('kit-1', true);
      expect(res).toEqual({ id: 'kit-1', published: true });
      expect(prisma.variant.update as jest.Mock).toHaveBeenCalled();
    });

    it('404s when the kit does not exist', async () => {
      const prisma = makePrisma({
        variant: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      const svc = await build(prisma);
      await expect(svc.setPublished('nope', false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('unflags the variant instead of deleting it', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = makePrisma({
        variant: {
          findFirst: jest.fn().mockResolvedValue({ id: 'kit-1' }),
          update,
        },
      });
      const svc = await build(prisma);
      const res = await svc.remove('kit-1');
      expect(res).toEqual({ id: 'kit-1' });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'kit-1' },
        data: { isProjectKit: false, kitPublished: false },
      });
    });
  });

  describe('move', () => {
    it('is a no-op moving the first kit up', async () => {
      const prisma = makePrisma({
        variant: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
        },
      });
      const svc = await build(prisma);
      const res = await svc.move('a', 'up');
      expect(res).toEqual({ id: 'a', moved: false });
      expect(prisma.$transaction as jest.Mock).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejects a part that is not a catalog variant', async () => {
      const tx = {
        product: { findFirst: jest.fn().mockResolvedValue(null) },
        variant: { findFirst: jest.fn().mockResolvedValue(null) },
        stockItem: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'raw-1', kind: 'RAW_MATERIAL' }]),
        },
      };
      const prisma = makePrisma({
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      });
      const svc = await build(prisma);
      await expect(
        svc.create({
          title: 'Bad Kit',
          kitPrice: '100',
          parts: [{ stockItemId: 'raw-1', quantity: '1' }],
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
