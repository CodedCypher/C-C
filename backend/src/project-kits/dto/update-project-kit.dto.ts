import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MONEY_2 } from '../../common/money';
import { KitPartInput } from './create-project-kit.dto';

const IMAGE_URL = /^(https?:\/\/|\/)/;

export class UpdateProjectKitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  // null clears the description; omit to leave unchanged.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  // null clears the hero image; omit to leave unchanged.
  @IsOptional()
  @Matches(IMAGE_URL, {
    message: 'image must be an absolute http(s) or root-relative URL',
  })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @Matches(MONEY_2, {
    message: 'kitPrice must be a number with up to 2 decimals',
  })
  kitPrice?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  // When present, fully replaces the kit's parts list (its active BOM lines).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'A kit needs at least one part.' })
  @ValidateNested({ each: true })
  @Type(() => KitPartInput)
  parts?: KitPartInput[];
}

export class PublishKitDto {
  @IsBoolean()
  published!: boolean;
}

export class MoveKitDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}
