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
  BomService,
  BomVariantsResult,
  BomVersionRow,
  BomDetail,
  ExplodeResult,
  BomCostResult,
  WhereUsedRow,
  FeasibilityResult,
  CreateBomResult,
} from './bom.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { structuredValidationPipe } from '../common/validation';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';

@Controller('bom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BomController {
  constructor(private readonly bomService: BomService) {}

  // ── Reads ──────────────────────────────────────────────────────────────────
  @Get('variants')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  variants(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<BomVariantsResult> {
    return this.bomService.listVariants({
      q,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('where-used')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  whereUsed(
    @Query('stockItemId') stockItemId: string,
  ): Promise<WhereUsedRow[]> {
    return this.bomService.whereUsed(stockItemId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  versions(@Query('variantId') variantId: string): Promise<BomVersionRow[]> {
    return this.bomService.listVersions(variantId);
  }

  @Get(':id/explode')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  explode(
    @Param('id') id: string,
    @Query('qty') qty?: string,
  ): Promise<ExplodeResult> {
    return this.bomService.explodeBom(id, qty ? Number(qty) : 1);
  }

  @Get(':id/cost')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  cost(
    @Param('id') id: string,
    @Query('qty') qty?: string,
  ): Promise<BomCostResult> {
    return this.bomService.costBom(id, qty ? Number(qty) : 1);
  }

  @Get(':id/feasibility')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  feasibility(
    @Param('id') id: string,
    @Query('warehouseId') warehouseId: string,
    @Query('qty') qty?: string,
  ): Promise<FeasibilityResult> {
    return this.bomService.feasibility(id, qty ? Number(qty) : 1, warehouseId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  detail(@Param('id') id: string): Promise<BomDetail> {
    return this.bomService.detail(id);
  }

  // ── Mutations / lifecycle ────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(
    @Body(structuredValidationPipe()) dto: CreateBomDto,
  ): Promise<CreateBomResult> {
    return this.bomService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateBomDto,
  ): Promise<CreateBomResult> {
    return this.bomService.update(id, dto);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  activate(@Param('id') id: string): Promise<CreateBomResult> {
    return this.bomService.activate(id);
  }
}
