import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { UnitOfMeasure } from '../../generated/prisma/client';
import { MONEY_4 } from '../../common/money';

export class InitialStockInput {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @Matches(MONEY_4, {
    message: 'onHand must be a number with up to 4 decimals',
  })
  onHand!: string;
}

export class CreateRawMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(UnitOfMeasure)
  defaultUnit!: UnitOfMeasure;

  @IsOptional()
  @Matches(MONEY_4, {
    message: 'standardCost must be a number with up to 4 decimals',
  })
  standardCost?: string;

  @IsOptional()
  @Matches(MONEY_4, {
    message: 'reorderPoint must be a number with up to 4 decimals',
  })
  reorderPoint?: string;

  @IsOptional()
  @Matches(MONEY_4, {
    message: 'reorderQty must be a number with up to 4 decimals',
  })
  reorderQty?: string;

  @IsOptional()
  @Matches(MONEY_4, {
    message: 'safetyStock must be a number with up to 4 decimals',
  })
  safetyStock?: string;

  @IsOptional()
  @IsBoolean()
  trackLot?: boolean;

  @IsOptional()
  @IsBoolean()
  trackSerial?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialStockInput)
  initialStock?: InitialStockInput[];
}

export class UpdateRawMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(UnitOfMeasure)
  defaultUnit?: UnitOfMeasure;

  // Nullable: pass null to clear the StockItem's standard cost.
  @IsOptional()
  @Matches(MONEY_4, {
    message: 'standardCost must be a number with up to 4 decimals',
  })
  standardCost?: string | null;

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

  @IsOptional()
  @IsBoolean()
  trackLot?: boolean;

  @IsOptional()
  @IsBoolean()
  trackSerial?: boolean;
}
