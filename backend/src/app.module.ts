import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryPostingModule } from './common/inventory/inventory-posting.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { BranchesModule } from './branches/branches.module';
import { RawMaterialsModule } from './raw-materials/raw-materials.module';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module';
import { BomModule } from './bom/bom.module';
import { BuildOrdersModule } from './build-orders/build-orders.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    InventoryPostingModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    WarehousesModule,
    BranchesModule,
    RawMaterialsModule,
    StockTransfersModule,
    BomModule,
    BuildOrdersModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
