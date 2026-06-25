// The generated Prisma client ships `.js`-suffixed internal imports Jest's
// CommonJS resolver can't map back to `.ts`; a stub PrismaService stands in, so
// we replace the module wholesale to keep the import chain loadable. The enum
// objects are referenced at DTO-decoration time and in publishAsProduct.
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  ProductStatus: { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' },
  SourcingType: { PURCHASED: 'PURCHASED', BUILT: 'BUILT' },
  UnitOfMeasure: {
    EACH: 'EACH',
    METER: 'METER',
    CENTIMETER: 'CENTIMETER',
    GRAM: 'GRAM',
    KILOGRAM: 'KILOGRAM',
    LITER: 'LITER',
    MILLILITER: 'MILLILITER',
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RawMaterialsService } from './raw-materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryPostingService } from '../common/inventory/inventory-posting.service';
import { ProductsService } from '../products/products.service';

describe('RawMaterialsService — publishAsProduct', () => {
  let service: RawMaterialsService;
  let prisma: {
    rawMaterial: { findFirst: jest.Mock; update: jest.Mock };
    warehouse: { findFirst: jest.Mock };
    variant: { findUnique: jest.Mock };
  };
  let products: { createProduct: jest.Mock };

  const MATERIAL = {
    id: 'rm-1',
    name: '10k Resistor',
    sku: 'RM-R10K',
    description: 'Through-hole 10k ohm',
    publishedVariantId: null as string | null,
  };

  beforeEach(async () => {
    prisma = {
      rawMaterial: {
        findFirst: jest.fn().mockResolvedValue({ ...MATERIAL }),
        update: jest.fn().mockResolvedValue({}),
      },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'wh-web' }) },
      variant: { findUnique: jest.fn().mockResolvedValue({ id: 'v-new' }) },
    };
    products = {
      createProduct: jest.fn().mockResolvedValue({
        id: 'p-new',
        slug: '10k-resistor',
        title: '10k Resistor',
        variantCount: 1,
      }),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RawMaterialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryPostingService, useValue: {} },
        { provide: ProductsService, useValue: products },
      ],
    }).compile();
    service = moduleRef.get(RawMaterialsService);
  });

  it('creates an ACTIVE product+variant with web stock and links the material', async () => {
    const res = await service.publishAsProduct('rm-1', {
      price: '5.00',
      initialStock: '200',
    });

    // Reused the canonical create path with the right shape.
    const dto = products.createProduct.mock.calls[0][0];
    expect(dto.status).toBe('ACTIVE');
    expect(dto.title).toBe('10k Resistor');
    expect(dto.variants).toHaveLength(1);
    expect(dto.variants[0].sku).toBe('RM-R10K'); // defaults to the material SKU
    expect(dto.variants[0].sourcingType).toBe('PURCHASED');
    expect(dto.variants[0].price).toBe('5.00');
    expect(dto.variants[0].isActive).toBe(true);
    expect(dto.variants[0].stock).toEqual([
      { warehouseId: 'wh-web', onHand: '200' },
    ]);

    // Provenance link recorded on the material.
    expect(prisma.rawMaterial.update).toHaveBeenCalledWith({
      where: { id: 'rm-1' },
      data: { publishedVariantId: 'v-new' },
    });

    expect(res).toEqual({
      rawMaterialId: 'rm-1',
      productId: 'p-new',
      variantId: 'v-new',
      slug: '10k-resistor',
      title: '10k Resistor',
    });
  });

  it('omits the stock row when initialStock is zero/absent', async () => {
    await service.publishAsProduct('rm-1', { price: '5.00' });
    const dto = products.createProduct.mock.calls[0][0];
    expect(dto.variants[0].stock).toEqual([]);
  });

  it('honours an explicit SKU and slug override', async () => {
    await service.publishAsProduct('rm-1', {
      price: '5.00',
      sku: 'COMP-R10K',
      slug: 'resistor-10k',
    });
    const dto = products.createProduct.mock.calls[0][0];
    expect(dto.variants[0].sku).toBe('COMP-R10K');
    expect(dto.slug).toBe('resistor-10k');
  });

  it('rejects publishing a material that is already published', async () => {
    prisma.rawMaterial.findFirst.mockResolvedValueOnce({
      ...MATERIAL,
      publishedVariantId: 'v-existing',
    });
    await expect(
      service.publishAsProduct('rm-1', { price: '5.00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(products.createProduct).not.toHaveBeenCalled();
  });

  it('404s when the material is missing or soft-deleted', async () => {
    prisma.rawMaterial.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.publishAsProduct('nope', { price: '5.00' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(products.createProduct).not.toHaveBeenCalled();
  });
});
