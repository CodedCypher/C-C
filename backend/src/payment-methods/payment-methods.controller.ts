import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  PaymentMethodsService,
  type PaymentMethodRow,
} from './payment-methods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { structuredValidationPipe } from '../common/validation';
import { fieldError } from '../common/structured-error';
import { qrImageMulterOptions } from '../common/uploads';

/**
 * Admin CRUD for payment methods (manual bank / e-wallet). Mirrors the other
 * admin domain controllers: read for staff, mutations for admins. The public
 * checkout reads only ACTIVE methods via `GET /storefront/payment-methods`.
 */
@Controller('payment-methods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class PaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @Get()
  list(): Promise<PaymentMethodRow[]> {
    return this.paymentMethods.list();
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<PaymentMethodRow> {
    return this.paymentMethods.detail(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(
    @Body(structuredValidationPipe()) dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodRow> {
    return this.paymentMethods.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodRow> {
    return this.paymentMethods.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.paymentMethods.remove(id);
  }

  /** Upload / replace the QR image (multipart, field `file`). */
  @Post(':id/qr')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file', qrImageMulterOptions))
  uploadQr(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PaymentMethodRow> {
    if (!file) {
      throw new BadRequestException(
        fieldError(
          'file',
          'Choose a QR image to upload',
          400,
          'ValidationError',
        ),
      );
    }
    return this.paymentMethods.setQrImage(id, file.filename);
  }
}
