import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';
import { structuredValidationPipe } from '../common/validation';
import { ProjectKitsService } from './project-kits.service';
import { CreateProjectKitDto } from './dto/create-project-kit.dto';
import {
  MoveKitDto,
  PublishKitDto,
  UpdateProjectKitDto,
} from './dto/update-project-kit.dto';

/**
 * Admin management for storefront "Build-a-Project" kits. A kit is a curated
 * lens over a BUILT variant + active BOM (no separate model). All routes are
 * staff-guarded; the public read side stays on /storefront/projects.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('project-kits')
export class ProjectKitsController {
  constructor(private readonly kits: ProjectKitsService) {}

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Get()
  list() {
    return this.kits.list();
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.kits.detail(id);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Post()
  create(@Body(structuredValidationPipe()) dto: CreateProjectKitDto) {
    return this.kits.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateProjectKitDto,
  ) {
    return this.kits.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Patch(':id/publish')
  publish(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: PublishKitDto,
  ) {
    return this.kits.setPublished(id, dto.published);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Patch(':id/move')
  move(
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: MoveKitDto,
  ) {
    return this.kits.move(id, dto.direction);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.kits.remove(id);
  }
}
