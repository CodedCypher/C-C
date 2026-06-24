import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/** A saved address as returned to the shopper (checkout address picker). */
export interface SavedAddress {
  id: string;
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  barangay: string | null;
  city: string;
  province: string | null;
  region: string;
  postalCode: string;
  country: string;
  regionCode: string | null;
  provinceCode: string | null;
  cityCode: string | null;
  barangayCode: string | null;
  isDefault: boolean;
}

const ADDRESS_SELECT = {
  id: true,
  name: true,
  phone: true,
  line1: true,
  line2: true,
  barangay: true,
  city: true,
  province: true,
  region: true,
  postalCode: true,
  country: true,
  regionCode: true,
  provinceCode: true,
  cityCode: true,
  barangayCode: true,
  isDefault: true,
} as const;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The signed-in user's saved addresses (default first, then newest). */
  list(userId: string): Promise<SavedAddress[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: ADDRESS_SELECT,
    });
  }

  /** Create a SHIPPING address for the user; if default, clears prior defaults. */
  async create(userId: string, dto: CreateAddressDto): Promise<SavedAddress> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId,
          type: 'SHIPPING',
          name: dto.name,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          barangay: dto.barangay,
          city: dto.city,
          province: dto.province,
          region: dto.region,
          postalCode: dto.postalCode,
          country: dto.country ?? 'Philippines',
          regionCode: dto.regionCode ?? null,
          provinceCode: dto.provinceCode ?? null,
          cityCode: dto.cityCode ?? null,
          barangayCode: dto.barangayCode ?? null,
          isDefault: dto.isDefault ?? false,
        },
        select: ADDRESS_SELECT,
      });
    });
  }

  /** Partial update of the user's own address; if made default, clears others. */
  async update(
    userId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<SavedAddress> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) throw this.notFound();

      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      const data: Prisma.AddressUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.line1 !== undefined) data.line1 = dto.line1;
      if (dto.line2 !== undefined) data.line2 = dto.line2 ?? null;
      if (dto.barangay !== undefined) data.barangay = dto.barangay;
      if (dto.city !== undefined) data.city = dto.city;
      if (dto.province !== undefined) data.province = dto.province;
      if (dto.region !== undefined) data.region = dto.region;
      if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
      if (dto.country !== undefined)
        data.country = dto.country ?? 'Philippines';
      if (dto.regionCode !== undefined)
        data.regionCode = dto.regionCode ?? null;
      if (dto.provinceCode !== undefined)
        data.provinceCode = dto.provinceCode ?? null;
      if (dto.cityCode !== undefined) data.cityCode = dto.cityCode ?? null;
      if (dto.barangayCode !== undefined)
        data.barangayCode = dto.barangayCode ?? null;
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

      return tx.address.update({
        where: { id },
        data,
        select: ADDRESS_SELECT,
      });
    });
  }

  /** Delete the user's own address. 404 if it isn't theirs. */
  async remove(userId: string, id: string): Promise<{ id: string }> {
    const res = await this.prisma.address.deleteMany({ where: { id, userId } });
    if (res.count === 0) throw this.notFound();
    return { id };
  }

  /** Mark one of the user's addresses default, clearing any prior default. */
  async setDefault(userId: string, id: string): Promise<SavedAddress> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!existing) throw this.notFound();

      await tx.address.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      return tx.address.update({
        where: { id },
        data: { isDefault: true },
        select: ADDRESS_SELECT,
      });
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      error: 'NotFound',
      fieldErrors: {},
      formErrors: ['Address not found.'],
    });
  }
}
