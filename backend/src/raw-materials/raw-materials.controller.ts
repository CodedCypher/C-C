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
  RawMaterialsService,
  RawMaterialsResult,
  RawMaterialDetail,
  CreateRawMaterialResult,
  PublishRawMaterialResult,
} from './raw-materials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import {
  CreateRawMaterialDto,
  UpdateRawMaterialDto,
} from './dto/create-raw-material.dto';
import { PublishRawMaterialDto } from './dto/publish-raw-material.dto';
import { structuredValidationPipe } from '../common/validation';

@Controller('raw-materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  rawMaterials(
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<RawMaterialsResult> {
    return this.rawMaterialsService.rawMaterials({
      q,
      filter,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  rawMaterial(@Param('id') id: string): Promise<RawMaterialDetail> {
    return this.rawMaterialsService.rawMaterial(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  createRawMaterial(
    @Body(structuredValidationPipe()) dto: CreateRawMaterialDto,
  ): Promise<CreateRawMaterialResult> {
    return this.rawMaterialsService.createRawMaterial(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  updateRawMaterial(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateRawMaterialDto,
  ): Promise<RawMaterialDetail> {
    return this.rawMaterialsService.updateRawMaterial(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  deleteRawMaterial(@Param('id') id: string): Promise<{ id: string }> {
    return this.rawMaterialsService.deleteRawMaterial(id);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  publishRawMaterial(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: PublishRawMaterialDto,
  ): Promise<PublishRawMaterialResult> {
    return this.rawMaterialsService.publishAsProduct(id, dto);
  }
}
