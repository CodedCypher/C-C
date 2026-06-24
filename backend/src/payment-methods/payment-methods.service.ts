import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fieldError } from '../common/structured-error';
import { QR_DIR, uploadUrl } from '../common/uploads';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

/** An admin-managed payment method (full admin view). */
export interface PaymentMethodRow {
  id: string;
  name: string;
  instructions: string | null;
  qrImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT = {
  id: true,
  name: true,
  instructions: true,
  qrImageUrl: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<PaymentMethodRow[]> {
    return this.prisma.paymentMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: SELECT,
    });
  }

  async detail(id: string): Promise<PaymentMethodRow> {
    const row = await this.prisma.paymentMethod.findUnique({
      where: { id },
      select: SELECT,
    });
    if (!row) {
      throw new NotFoundException(
        fieldError('id', 'Payment method not found', 404, 'NotFound'),
      );
    }
    return row;
  }

  create(dto: CreatePaymentMethodDto): Promise<PaymentMethodRow> {
    return this.prisma.paymentMethod.create({
      data: {
        name: dto.name,
        instructions: dto.instructions ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: SELECT,
    });
  }

  async update(
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodRow> {
    await this.detail(id); // 404 if missing
    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.instructions !== undefined
          ? { instructions: dto.instructions }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      select: SELECT,
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.detail(id);
    await this.prisma.paymentMethod.delete({ where: { id } });
    return { id };
  }

  /** Attach (or replace) the QR image after a multipart upload. */
  async setQrImage(id: string, filename: string): Promise<PaymentMethodRow> {
    await this.detail(id);
    return this.prisma.paymentMethod.update({
      where: { id },
      data: { qrImageUrl: uploadUrl(QR_DIR, filename) },
      select: SELECT,
    });
  }
}
