import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrdersService, OrdersResult } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SUPERADMIN)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  orders(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ): Promise<OrdersResult> {
    return this.ordersService.orders({
      status,
      q,
      page: page ? Number(page) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
