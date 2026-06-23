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
  InventoryService,
  InventoryResult,
  InventoryDetailResult,
  AdjustStockResult,
  InventoryOption,
} from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { AdjustStockDto, SetReorderDto } from './dto/stock-mutation.dto';
import { structuredValidationPipe } from '../common/validation';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  inventory(
    @Query('filter') filter?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<InventoryResult> {
    return this.inventoryService.inventory({
      filter,
      q,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
      warehouseId: warehouseId || undefined,
    });
  }

  // Declared BEFORE :stockItemId so the literal route isn't shadowed by the param.
  @Get('options')
  options(
    @Query('q') q?: string,
    @Query('kind') kind?: string,
  ): Promise<InventoryOption[]> {
    return this.inventoryService.options({ q, kind });
  }

  @Get(':stockItemId')
  detail(
    @Param('stockItemId') stockItemId: string,
  ): Promise<InventoryDetailResult> {
    return this.inventoryService.detail(stockItemId);
  }

  @Post(':stockItemId/adjust')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  adjust(
    @Param('stockItemId') stockItemId: string,
    @Body(structuredValidationPipe()) dto: AdjustStockDto,
  ): Promise<AdjustStockResult> {
    return this.inventoryService.adjust(stockItemId, dto);
  }

  @Patch(':stockItemId/reorder')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setReorder(
    @Param('stockItemId') stockItemId: string,
    @Body(structuredValidationPipe()) dto: SetReorderDto,
  ): Promise<{ id: string }> {
    return this.inventoryService.setReorder(stockItemId, dto);
  }

  @Patch(':stockItemId/warehouses/:warehouseId/reorder')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setWarehouseReorder(
    @Param('stockItemId') stockItemId: string,
    @Param('warehouseId') warehouseId: string,
    @Body(structuredValidationPipe()) dto: SetReorderDto,
  ): Promise<{ stockItemId: string; warehouseId: string }> {
    return this.inventoryService.setWarehouseReorder(
      stockItemId,
      warehouseId,
      dto,
    );
  }
}
