// The generated Prisma client ships `.js`-suffixed internal imports Jest's
// CommonJS resolver can't map back to `.ts`; a stub stands in for PrismaService,
// so we replace the module wholesale to keep the import chain loadable. We also
// stub `@google/genai` (only loaded transitively via the matcher module) so Jest
// never has to resolve that ESM package.
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  // dto/storefront.dto references this enum value at decoration time.
  FulfillmentType: { DELIVERY: 'DELIVERY', PICKUP: 'PICKUP' },
}));
jest.mock('@google/genai', () => ({ GoogleGenAI: class {}, Type: {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StorefrontService } from './storefront.service';
import { BuildMatcherService } from './build-matcher.service';
import { UrlFetcherService } from './url-fetcher.service';
import { PrismaService } from '../prisma/prisma.service';

const stock = (onHand: number, rp = 5) => ({
  reorderPoint: rp,
  warehouseStock: [{ onHand, reserved: 0, reorderPoint: rp }],
});

// Per-variant detail (buildVariantSelect shape) with web-warehouse stock.
const DETAIL: Record<string, unknown> = {
  'v-esp32': {
    id: 'v-esp32',
    sku: 'ESP32',
    title: 'ESP32 Dev Board',
    price: 355,
    isActive: true,
    deletedAt: null,
    product: {
      slug: 'esp32',
      title: 'ESP32 Dev Board',
      status: 'ACTIVE',
      images: [{ url: 'esp32.jpg' }],
    },
    stockItem: stock(88), // IN
  },
  'v-bme280': {
    id: 'v-bme280',
    sku: 'BME280',
    title: 'BME280 Sensor',
    price: 310,
    isActive: true,
    deletedAt: null,
    product: {
      slug: 'bme280',
      title: 'BME280 Sensor',
      status: 'ACTIVE',
      images: [],
    },
    stockItem: stock(0), // OUT — primary that should auto-swap
  },
  'v-bme280-alt': {
    id: 'v-bme280-alt',
    sku: 'BMP280',
    title: 'BMP280 Sensor (alt)',
    price: 280,
    isActive: true,
    deletedAt: null,
    product: {
      slug: 'bmp280',
      title: 'BMP280 Sensor (alt)',
      status: 'ACTIVE',
      images: [],
    },
    stockItem: stock(40), // IN — the swap target
  },
  'v-mpu': {
    id: 'v-mpu',
    sku: 'MPU6050',
    title: 'MPU6050 IMU',
    price: 150,
    isActive: true,
    deletedAt: null,
    product: {
      slug: 'mpu6050',
      title: 'MPU6050 IMU',
      status: 'ACTIVE',
      images: [],
    },
    stockItem: stock(0), // OUT, no alternatives → stays OUT_OF_STOCK
  },
};

// Compact catalog rows (buildCatalog shape, incl. stockItem for availability).
const CATALOG = Object.values(DETAIL).map((v) => {
  const d = v as {
    id: string;
    sku: string;
    title: string;
    price: number;
    stockItem: unknown;
  };
  return {
    id: d.id,
    sku: d.sku,
    title: d.title,
    price: d.price,
    product: { title: d.title, brand: { name: 'Acme' } },
    stockItem: d.stockItem,
  };
});

// The matcher's verdict: clean match, OOS-with-swap, OOS-no-swap, miss.
const MATCHED = [
  {
    rawLabel: 'ESP32 dev board',
    qty: 1,
    matchedVariantId: 'v-esp32',
    confidence: 0.95,
    note: null,
    alternativeVariantIds: [],
  },
  {
    rawLabel: 'BME280 sensor',
    qty: 1,
    matchedVariantId: 'v-bme280',
    confidence: 0.9,
    note: null,
    alternativeVariantIds: ['v-bme280-alt'],
  },
  {
    rawLabel: 'MPU6050 imu',
    qty: 1,
    matchedVariantId: 'v-mpu',
    confidence: 0.8,
    note: null,
    alternativeVariantIds: [],
  },
  {
    rawLabel: '10k resistor',
    qty: 5,
    matchedVariantId: null,
    confidence: 0,
    note: 'no catalog match; search resistors',
    alternativeVariantIds: [],
  },
];

function makePrismaStub() {
  const store: { created: Record<string, unknown> | null } = { created: null };
  return {
    store,
    variant: {
      findMany: jest.fn(({ where }: { where?: { id?: { in: string[] } } }) => {
        if (where?.id?.in) {
          return Promise.resolve(
            where.id.in.map((id) => DETAIL[id]).filter(Boolean),
          );
        }
        return Promise.resolve(CATALOG);
      }),
    },
    savedBuild: {
      create: jest.fn(
        ({
          data,
        }: {
          data: {
            title: string;
            sourceType: string;
            lines: { create: Record<string, unknown>[] };
          };
        }) => {
          store.created = {
            id: 'build-1',
            title: data.title,
            sourceType: data.sourceType,
            createdAt: new Date('2026-06-24T00:00:00.000Z'),
            lines: data.lines.create.map((l, i) => ({
              id: `l${i}`,
              buildId: 'build-1',
              position: i,
              ...l,
            })),
          };
          return Promise.resolve(store.created);
        },
      ),
      findUnique: jest.fn(() => Promise.resolve(store.created)),
      findMany: jest.fn(() => Promise.resolve([])),
      findFirst: jest.fn(() => Promise.resolve(null)),
      delete: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({ id: where.id }),
      ),
    },
  };
}

describe('StorefrontService — builds', () => {
  let service: StorefrontService;
  let prisma: ReturnType<typeof makePrismaStub>;
  let matcher: {
    enabled: boolean;
    match: jest.Mock;
    matchImage: jest.Mock;
  };
  let urlFetcher: { fetchInspiration: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaStub();
    matcher = {
      enabled: true,
      match: jest.fn().mockResolvedValue(MATCHED),
      matchImage: jest.fn().mockResolvedValue(MATCHED),
    };
    urlFetcher = { fetchInspiration: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StorefrontService,
        { provide: PrismaService, useValue: prisma },
        { provide: BuildMatcherService, useValue: matcher },
        { provide: UrlFetcherService, useValue: urlFetcher },
      ],
    }).compile();
    service = moduleRef.get(StorefrontService);
  });

  it('auto-swaps an OOS primary to its in-stock alternative, transparently', async () => {
    const { build, token } = await service.resolveBuild(
      undefined,
      { kind: 'text', text: '...' },
      undefined,
    );

    expect(typeof token).toBe('string');
    // The matcher saw a stock-aware catalog (availability on each row).
    const firstCall = matcher.match.mock.calls[0] as unknown[];
    const catalogArg = firstCall[1] as {
      availability: string;
    }[];
    expect(catalogArg).toHaveLength(4);
    expect(catalogArg[0].availability).toBeDefined();

    expect(build.parts).toHaveLength(3);
    expect(build.unmatched).toHaveLength(1);
    expect(build.partCount).toBe(4);

    const esp = build.parts.find((p) => p.rawLabel === 'ESP32 dev board')!;
    expect(esp.status).toBe('MATCHED');
    expect(esp.canAdd).toBe(true);
    expect(esp.swappedFrom).toBeNull();

    // The OOS BME280 became its in-stock BMP280 alternative.
    const bme = build.parts.find((p) => p.rawLabel === 'BME280 sensor')!;
    expect(bme.variantId).toBe('v-bme280-alt');
    expect(bme.status).toBe('SUBSTITUTED');
    expect(bme.canAdd).toBe(true);
    expect(bme.unitPrice).toBe(280); // DB truth, not the matcher
    expect(bme.swappedFrom).toEqual({
      rawLabel: 'BME280 sensor',
      title: 'BME280 Sensor',
    });
    // The original OOS pick is offered as a revert option.
    expect(bme.alternatives.map((a) => a.variantId)).toContain('v-bme280');

    // OOS with no alternative stays flagged (not a false swap).
    const mpu = build.parts.find((p) => p.rawLabel === 'MPU6050 imu')!;
    expect(mpu.status).toBe('OUT_OF_STOCK');
    expect(mpu.canAdd).toBe(false);
    expect(mpu.swappedFrom).toBeNull();

    // Ready count + total now include the swapped-in part (ESP32 + BMP280).
    expect(build.inStockCount).toBe(2);
    expect(build.estimatedTotal).toBe(355 + 280);

    expect(build.unmatched[0].rawLabel).toBe('10k resistor');
  });

  it('re-resolves a saved build by id with the same shape', async () => {
    await service.resolveBuild(
      undefined,
      { kind: 'text', text: 'x' },
      undefined,
    );
    const build = await service.getBuild('build-1');
    expect(build.id).toBe('build-1');
    expect(build.parts).toHaveLength(3);
    expect(
      build.parts.find((p) => p.rawLabel === 'BME280 sensor')!.variantId,
    ).toBe('v-bme280-alt');
  });

  it('rejects input the matcher cannot turn into any parts', async () => {
    matcher.match.mockResolvedValueOnce([]);
    await expect(
      service.resolveBuild(
        undefined,
        { kind: 'text', text: 'lorem ipsum' },
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('routes a URL door through the fetcher then the text matcher', async () => {
    urlFetcher.fetchInspiration.mockResolvedValueOnce('fetched page text');
    const { build } = await service.resolveBuild(
      undefined,
      { kind: 'url', url: 'https://example.com/build' },
      undefined,
    );
    expect(urlFetcher.fetchInspiration).toHaveBeenCalledWith(
      'https://example.com/build',
    );
    // The fetched text — not the URL — is what the matcher sees.
    const urlCall = matcher.match.mock.calls[0] as unknown[];
    expect(urlCall[0]).toBe('fetched page text');
    expect(build.sourceType).toBe('URL');
  });

  it('routes a photo door through the vision matcher', async () => {
    const { build } = await service.resolveBuild(
      undefined,
      {
        kind: 'image',
        data: 'AAAA',
        mimeType: 'image/png',
        filename: 'bom.png',
      },
      undefined,
    );
    expect(matcher.matchImage).toHaveBeenCalledWith(
      { data: 'AAAA', mimeType: 'image/png' },
      expect.any(Array),
    );
    expect(matcher.match).not.toHaveBeenCalled();
    expect(build.sourceType).toBe('IMAGE');
  });

  it('lists the caller’s builds (guest scoped by cookie token)', async () => {
    prisma.savedBuild.findMany.mockResolvedValueOnce([
      {
        id: 'b1',
        title: 'Weather station',
        sourceType: 'TEXT',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        _count: { lines: 5 },
      },
    ]);
    const list = await service.listBuilds('tok-guest', undefined);
    expect(prisma.savedBuild.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionToken: 'tok-guest' } }),
    );
    expect(list).toEqual([
      {
        id: 'b1',
        slug: 'b1',
        title: 'Weather station',
        sourceType: 'TEXT',
        partCount: 5,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
  });

  it('returns no builds for an owner with neither user nor token', async () => {
    const list = await service.listBuilds(undefined, undefined);
    expect(list).toEqual([]);
    expect(prisma.savedBuild.findMany).not.toHaveBeenCalled();
  });

  it('deletes only a build the caller owns, else 404', async () => {
    prisma.savedBuild.findFirst.mockResolvedValueOnce({ id: 'b1' });
    await expect(service.deleteBuild('b1', 'tok', undefined)).resolves.toEqual({
      id: 'b1',
    });
    expect(prisma.savedBuild.delete).toHaveBeenCalledWith({
      where: { id: 'b1' },
    });

    prisma.savedBuild.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.deleteBuild('someone-elses', 'tok', undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
