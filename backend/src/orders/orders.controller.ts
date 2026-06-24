import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  OrdersService,
  OrdersResult,
  OrderDetail,
  OrderActionResult,
  PaymentInfo,
} from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { structuredValidationPipe } from '../common/validation';
import { fieldError } from '../common/structured-error';
import {
  paymentProofMulterOptions,
  PROOF_DIR,
  uploadUrl,
} from '../common/uploads';
import { ShipOrderDto } from './dto/ship-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Reads ──────────────────────────────────────────────────────────────────
  @Get()
  orders(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<OrdersResult> {
    return this.ordersService.orders({
      status,
      q,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  order(@Param('id') id: string): Promise<OrderDetail> {
    return this.ordersService.order(id);
  }

  // ── Manual-payment + fulfillment lifecycle ───────────────────────────────────
  @Post(':id/payment-proof')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file', paymentProofMulterOptions))
  uploadPaymentProof(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('reference') reference?: string,
  ): Promise<PaymentInfo> {
    if (!file) {
      throw new BadRequestException(
        fieldError(
          'file',
          'A proof image file is required.',
          400,
          'ValidationError',
        ),
      );
    }
    return this.ordersService.uploadPaymentProof(
      id,
      uploadUrl(PROOF_DIR, file.filename),
      reference,
    );
  }

  @Post(':id/verify-payment')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  verifyPayment(@Param('id') id: string): Promise<OrderActionResult> {
    return this.ordersService.verifyPayment(id);
  }

  @Post(':id/reject-payment')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  rejectPayment(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ): Promise<OrderActionResult> {
    return this.ordersService.rejectPayment(id, reason);
  }

  @Post(':id/ship')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  ship(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: ShipOrderDto,
  ): Promise<OrderActionResult> {
    return this.ordersService.ship(id, dto);
  }

  @Post(':id/deliver')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  deliver(@Param('id') id: string): Promise<OrderActionResult> {
    return this.ordersService.deliver(id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  cancel(@Param('id') id: string): Promise<OrderActionResult> {
    return this.ordersService.cancel(id);
  }
}
