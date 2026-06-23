import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { MONEY_4 } from '../../common/money';

export class CreateBuildOrderDto {
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  // When omitted, the variant's active BOM is used.
  @IsOptional()
  @IsString()
  bomId?: string;

  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @Matches(MONEY_4, {
    message: 'qtyPlanned must be a number with up to 4 decimals',
  })
  qtyPlanned!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
