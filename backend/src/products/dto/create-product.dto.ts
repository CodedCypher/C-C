import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus, SourcingType } from '../../generated/prisma/client';
import { MONEY_2, MONEY_4 } from '../../common/money';

// Slug: lowercase words separated by single hyphens.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// URL: http(s) absolute OR root-relative path (data uses '/products/x.jpg').
const IMAGE_URL = /^(https?:\/\/|\/)/;

export class OptionValueInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  value!: string;
}

export class OptionTypeInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OptionValueInput)
  values!: OptionValueInput[];
}

export class VariantStockInput {
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @Matches(MONEY_4, { message: 'onHand must be a number with up to 4 decimals' })
  onHand!: string;
}

export class VariantInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsEnum(SourcingType)
  sourcingType!: SourcingType;

  @Matches(MONEY_2, { message: 'price must be a number with up to 2 decimals' })
  price!: string;

  @IsOptional()
  @Matches(MONEY_2, {
    message: 'compareAtPrice must be a number with up to 2 decimals',
  })
  compareAtPrice?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsBoolean()
  isActive!: boolean;

  // Ordered value-strings, index-aligned to CreateProductDto.optionTypes.
  @IsArray()
  @IsString({ each: true })
  optionValues!: string[];

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantStockInput)
  stock!: VariantStockInput[];
}

export class ImageInput {
  @IsString()
  @IsNotEmpty()
  @Matches(IMAGE_URL, {
    message: 'url must be an absolute http(s) or root-relative path',
  })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string;

  @IsBoolean()
  isPrimary!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  variantIndex?: number;
}

export class SpecInput {
  @IsOptional()
  @IsString()
  group?: string;

  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Matches(SLUG, {
    message: 'slug must be lowercase words separated by single hyphens',
  })
  @MaxLength(200)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsArray()
  @IsString({ each: true })
  categoryIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(70)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionTypeInput)
  optionTypes!: OptionTypeInput[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantInput)
  variants!: VariantInput[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInput)
  images!: ImageInput[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecInput)
  specs!: SpecInput[];
}

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
