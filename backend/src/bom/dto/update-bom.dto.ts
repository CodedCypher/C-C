import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BomLineInput } from './create-bom.dto';

export class UpdateBomDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // When provided, replaces the line set wholesale (same validations as create).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BomLineInput)
  lines?: BomLineInput[];
}
