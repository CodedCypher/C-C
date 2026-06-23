import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

export class BomLineInput {
  @IsString()
  @IsNotEmpty()
  stockItemId!: string;

  @Matches(MONEY_4, {
    message: 'quantity must be a number with up to 4 decimals',
  })
  quantity!: string;

  @IsEnum(UnitOfMeasure)
  unit!: UnitOfMeasure;

  // Fraction (e.g. "0.05" = 5% scrap). Optional.
  @IsOptional()
  @Matches(MONEY_4, {
    message: 'scrapPct must be a number with up to 4 decimals',
  })
  scrapPct?: string;
}

export class CreateBomDto {
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BomLineInput)
  lines!: BomLineInput[];
}
