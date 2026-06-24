import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtUser } from '../auth/strategies/jwt.strategy';
import { structuredValidationPipe } from '../common/validation';
import {
  AccountService,
  type CustomerProfileInfo,
  type MyOrderDetail,
  type MyOrdersResult,
} from './account.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Self-service endpoints for the signed-in customer. Guarded by auth only (any
 * logged-in user, no role check) and always scoped to `req.user.id`, so a
 * customer can only ever read/edit their own profile and orders.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('profile')
  getProfile(@Req() req: Request): Promise<CustomerProfileInfo> {
    return this.account.getProfile((req.user as JwtUser).id);
  }

  @Patch('profile')
  updateProfile(
    @Req() req: Request,
    @Body(structuredValidationPipe()) dto: UpdateProfileDto,
  ): Promise<CustomerProfileInfo> {
    return this.account.updateProfile((req.user as JwtUser).id, dto);
  }

  @Get('orders')
  orders(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<MyOrdersResult> {
    return this.account.listOrders((req.user as JwtUser).id, {
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('orders/:id')
  order(@Req() req: Request, @Param('id') id: string): Promise<MyOrderDetail> {
    return this.account.order((req.user as JwtUser).id, id);
  }
}
