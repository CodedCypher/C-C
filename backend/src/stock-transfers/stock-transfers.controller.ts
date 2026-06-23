import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  StockTransfersService,
  TransfersResult,
  TransferDetail,
  CreateTransferResult,
} from './stock-transfers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TransferStatus, UserRole } from '../generated/prisma/client';
import { structuredValidationPipe } from '../common/validation';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';

@Controller('stock-transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockTransfersController {
  constructor(
    private readonly stockTransfersService: StockTransfersService,
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  transfers(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<TransfersResult> {
    return this.stockTransfersService.transfers({
      status,
      q,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  transfer(@Param('id') id: string): Promise<TransferDetail> {
    return this.stockTransfersService.transfer(id);
  }

  // ── Mutations / lifecycle ────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  createTransfer(
    @Body(structuredValidationPipe()) dto: CreateTransferDto,
  ): Promise<CreateTransferResult> {
    return this.stockTransfersService.createTransfer(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  updateTransfer(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateTransferDto,
  ): Promise<CreateTransferResult> {
    return this.stockTransfersService.updateTransfer(id, dto);
  }

  @Post(':id/request')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  requestTransfer(
    @Param('id') id: string,
  ): Promise<{ id: string; status: TransferStatus }> {
    return this.stockTransfersService.requestTransfer(id);
  }

  @Post(':id/ship')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  shipTransfer(
    @Param('id') id: string,
  ): Promise<{ id: string; status: TransferStatus }> {
    return this.stockTransfersService.shipTransfer(id);
  }

  @Post(':id/receive')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  receiveTransfer(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: ReceiveTransferDto,
  ): Promise<{ id: string; status: TransferStatus }> {
    return this.stockTransfersService.receiveTransfer(id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  cancelTransfer(
    @Param('id') id: string,
  ): Promise<{ id: string; status: TransferStatus }> {
    return this.stockTransfersService.cancelTransfer(id);
  }
}
