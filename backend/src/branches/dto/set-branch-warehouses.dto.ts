import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BranchWarehouseLinkInput {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class SetBranchWarehousesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchWarehouseLinkInput)
  links!: BranchWarehouseLinkInput[];
}
