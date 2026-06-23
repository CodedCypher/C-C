import { IsOptional, IsString, IsNotEmpty, Matches } from 'class-validator';
import { MONEY_4 } from '../../common/money';

// Signed 4dp delta for stock adjustments (decimal 14,4). Allows a leading '-'.
const SIGNED_MONEY_4 = /^-?\d{1,10}(\.\d{1,4})?$/;

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @Matches(SIGNED_MONEY_4, {
    message: 'qtyDelta must be a signed number with up to 4 decimals',
  })
  qtyDelta!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SetReorderDto {
  @IsOptional()
  @Matches(MONEY_4, {
    message: 'reorderPoint must be a number with up to 4 decimals',
  })
  reorderPoint?: string | null;

  @IsOptional()
  @Matches(MONEY_4, {
    message: 'reorderQty must be a number with up to 4 decimals',
  })
  reorderQty?: string | null;

  @IsOptional()
  @Matches(MONEY_4, {
    message: 'safetyStock must be a number with up to 4 decimals',
  })
  safetyStock?: string | null;
}
