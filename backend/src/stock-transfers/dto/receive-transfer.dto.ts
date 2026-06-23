import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { MONEY_4 } from '../../common/money';

export class ReceiveLineInput {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @Matches(MONEY_4, {
    message: 'qtyReceived must be a number with up to 4 decimals',
  })
  qtyReceived!: string;
}

export class ReceiveTransferDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineInput)
  lines!: ReceiveLineInput[];
}
