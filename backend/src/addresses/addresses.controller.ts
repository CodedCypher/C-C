import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/strategies/jwt.strategy';
import { structuredValidationPipe } from '../common/validation';
import { AddressesService, type SavedAddress } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/**
 * Saved delivery addresses for the signed-in shopper. Guarded by auth only (any
 * logged-in user — no role check) so the storefront checkout can list + add the
 * current user's addresses. Always scoped to `req.user.id`.
 */
@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@Req() req: Request): Promise<SavedAddress[]> {
    return this.addresses.list((req.user as JwtUser).id);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body(structuredValidationPipe()) dto: CreateAddressDto,
  ): Promise<SavedAddress> {
    return this.addresses.create((req.user as JwtUser).id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(structuredValidationPipe()) dto: UpdateAddressDto,
  ): Promise<SavedAddress> {
    return this.addresses.update((req.user as JwtUser).id, id, dto);
  }

  @Patch(':id/default')
  setDefault(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<SavedAddress> {
    return this.addresses.setDefault((req.user as JwtUser).id, id);
  }

  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string }> {
    return this.addresses.remove((req.user as JwtUser).id, id);
  }
}
