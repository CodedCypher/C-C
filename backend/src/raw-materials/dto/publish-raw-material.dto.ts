import { IsOptional, IsString, IsNotEmpty, Matches } from 'class-validator';
import { MONEY_2, MONEY_4 } from '../../common/money';

/**
 * POST /raw-materials/:id/publish — turn an internal raw material into a
 * sellable storefront Product + Variant. The new variant gets its OWN web-stock
 * pool (StockItem.kind = VARIANT); it is NOT synced with the material's stock.
 */
export class PublishRawMaterialDto {
  /** Listed sale price for the new variant (2-decimal money). */
  @Matches(MONEY_2, {
    message: 'price must be a number with up to 2 decimals',
  })
  price!: string;

  /** Initial sellable on-hand at the default web warehouse. Defaults to "0". */
  @IsOptional()
  @Matches(MONEY_4, {
    message: 'initialStock must be a number with up to 4 decimals',
  })
  initialStock?: string;

  /** Variant SKU. Defaults to the material's SKU (Variant.sku must be unique). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  /** Product slug. Defaults to a slugified material name. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;

  /** Optional storefront category to file the new product under. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}
