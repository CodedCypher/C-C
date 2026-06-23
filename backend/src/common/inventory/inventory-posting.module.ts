import { Global, Module } from '@nestjs/common';
import { InventoryPostingService } from './inventory-posting.service';

/**
 * Global so every feature module (inventory, stock-transfers, build-orders, …)
 * can inject InventoryPostingService without re-importing. Imported once in
 * AppModule. The service is stateless and operates on a passed-in tx client.
 */
@Global()
@Module({
  providers: [InventoryPostingService],
  exports: [InventoryPostingService],
})
export class InventoryPostingModule {}
