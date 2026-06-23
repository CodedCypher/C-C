import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MONEY_4 } from '../../common/money';

export class TransferLineInput {
  @IsString()
  @IsNotEmpty()
  stockItemId!: string;

  @Matches(MONEY_4, {
    message: 'quantity must be a number with up to 4 decimals',
  })
  quantity!: string;
}

export class CreateTransferDto {
  @IsString()
  @IsNotEmpty()
  sourceWarehouseId!: string;

  @IsString()
  @IsNotEmpty()
  destWarehouseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineInput)
  lines!: TransferLineInput[];
}
