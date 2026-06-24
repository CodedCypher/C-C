import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /orders/:id/ship — optional ship-from warehouse override + carrier info.
 * When `warehouseId` is omitted the service uses the order's resolved default
 * warehouse (isDefaultWeb for WEB, the branch's default for POS).
 */
export class ShipOrderDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;
}
