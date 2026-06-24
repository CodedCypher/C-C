import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

/** Saved delivery addresses for signed-in shoppers (used by checkout). */
@Module({
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
