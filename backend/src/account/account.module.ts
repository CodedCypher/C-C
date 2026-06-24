import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

/** Self-service profile + order history for signed-in customers (`/me/*`). */
@Module({
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
