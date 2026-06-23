import { Module } from '@nestjs/common';
import { BuildOrdersController } from './build-orders.controller';
import { BuildOrdersService } from './build-orders.service';
import { BomModule } from '../bom/bom.module';

@Module({
  imports: [BomModule],
  controllers: [BuildOrdersController],
  providers: [BuildOrdersService],
})
export class BuildOrdersModule {}
