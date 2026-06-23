import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  BuildOrdersService,
  BuildOrdersResult,
  BuildOrderDetail,
} from './build-orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BuildStatus, UserRole } from '../generated/prisma/client';
import { structuredValidationPipe } from '../common/validation';
import { CreateBuildOrderDto } from './dto/create-build-order.dto';
import { CompleteBuildDto } from './dto/complete-build.dto';

@Controller('build-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BuildOrdersController {
  constructor(private readonly buildOrdersService: BuildOrdersService) {}

  // ── Reads ──────────────────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<BuildOrdersResult> {
    return this.buildOrdersService.list({
      status,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  detail(@Param('id') id: string): Promise<BuildOrderDetail> {
    return this.buildOrdersService.detail(id);
  }

  // ── Mutations / lifecycle ────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(
    @Body(structuredValidationPipe()) dto: CreateBuildOrderDto,
  ): Promise<{ id: string }> {
    return this.buildOrdersService.create(dto);
  }

  @Post(':id/plan')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  plan(@Param('id') id: string): Promise<{ id: string; status: BuildStatus }> {
    return this.buildOrdersService.plan(id);
  }

  @Post(':id/start')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  start(
    @Param('id') id: string,
  ): Promise<{ id: string; status: BuildStatus }> {
    return this.buildOrdersService.start(id);
  }

  @Post(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  complete(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: CompleteBuildDto,
  ): Promise<{ id: string; status: BuildStatus; computedUnitCost: number }> {
    return this.buildOrdersService.complete(id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  cancel(
    @Param('id') id: string,
  ): Promise<{ id: string; status: BuildStatus }> {
    return this.buildOrdersService.cancel(id);
  }
}
