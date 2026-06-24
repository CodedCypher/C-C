import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MONEY_2, MONEY_4 } from '../../common/money';

// Mirror the validators the rest of the catalog uses.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_URL = /^(https?:\/\/|\/)/;

/**
 * One part of a kit. A part is always a sellable catalog product — i.e. a
 * StockItem of kind VARIANT (validated in the service). Quantity is a decimal
 * string (matches BOM line quantities); unit is fixed to EACH server-side.
 */
export class KitPartInput {
  @IsString()
  @IsNotEmpty()
  stockItemId!: string;

  @Matches(MONEY_4, {
    message: 'quantity must be a number with up to 4 decimals',
  })
  quantity!: string;
}

export class CreateProjectKitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  // Optional explicit slug; otherwise derived from the title in the service.
  @IsOptional()
  @Matches(SLUG, {
    message: 'slug must be lowercase words separated by single hyphens',
  })
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Matches(IMAGE_URL, {
    message: 'image must be an absolute http(s) or root-relative URL',
  })
  @MaxLength(2048)
  imageUrl?: string;

  // The assembled "kit price" stored on the BUILT variant (2dp money string).
  @Matches(MONEY_2, {
    message: 'kitPrice must be a number with up to 2 decimals',
  })
  kitPrice!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A kit needs at least one part.' })
  @ValidateNested({ each: true })
  @Type(() => KitPartInput)
  parts!: KitPartInput[];
}
