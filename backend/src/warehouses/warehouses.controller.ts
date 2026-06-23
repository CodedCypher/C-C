import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  WarehousesService,
  WarehouseRow,
  WarehouseDetail,
  WarehouseStockResult,
} from './warehouses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { structuredValidationPipe } from '../common/validation';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  warehouses(): Promise<WarehouseRow[]> {
    return this.warehousesService.warehouses();
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<WarehouseDetail> {
    return this.warehousesService.detail(id);
  }

  @Get(':id/stock')
  stock(
    @Param('id') id: string,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<WarehouseStockResult> {
    return this.warehousesService.stock(id, {
      q,
      filter,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(
    @Body(structuredValidationPipe()) dto: CreateWarehouseDto,
  ): Promise<{ id: string; code: string; name: string }> {
    return this.warehousesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateWarehouseDto,
  ): Promise<{ id: string }> {
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  remove(@Param('id') id: string): Promise<{ id: string }> {
    return this.warehousesService.remove(id);
  }
}
