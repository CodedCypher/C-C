import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TransferLineInput } from './create-transfer.dto';

// Edit notes/lines while the transfer is still in DRAFT. Lines fully replace
// the existing set (same shape as create).
export class UpdateTransferDto {
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
