import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  BranchesService,
  BranchRow,
  BranchDetail,
  BranchInventoryResult,
} from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SetBranchWarehousesDto } from './dto/set-branch-warehouses.dto';
import { structuredValidationPipe } from '../common/validation';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  branches(): Promise<BranchRow[]> {
    return this.branchesService.branches();
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<BranchDetail> {
    return this.branchesService.detail(id);
  }

  @Get(':id/inventory')
  inventory(
    @Param('id') id: string,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<BranchInventoryResult> {
    return this.branchesService.inventory(id, {
      q,
      filter,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(
    @Body(structuredValidationPipe()) dto: CreateBranchDto,
  ): Promise<{ id: string; code: string; name: string }> {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateBranchDto,
  ): Promise<{ id: string }> {
    return this.branchesService.update(id, dto);
  }

  @Put(':id/warehouses')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setWarehouses(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: SetBranchWarehousesDto,
  ): Promise<BranchDetail> {
    return this.branchesService.setWarehouses(id, dto);
  }
}
