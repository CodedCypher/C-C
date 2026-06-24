import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { BuildChatMode, FulfillmentType } from '../../generated/prisma/client';

/** POST /storefront/cart/lines — add a variant to the cart. */
export class AddLineDto {
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

/** PATCH /storefront/cart/lines/:variantId — set the line quantity (0 removes). */
export class UpdateLineDto {
  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number;
}

/**
 * POST /storefront/builds/resolve — resolve maker inspiration into a cart from
 * EITHER a pasted parts list (`text`) OR a tutorial link (`url`). When `url` is
 * present it takes precedence and `text` is ignored; otherwise `text` is
 * required. The photo door is a separate multipart endpoint (`resolve-image`).
 */
export class ResolveBuildDto {
  @ValidateIf((o: ResolveBuildDto) => o.url == null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  text?: string;

  @ValidateIf((o: ResolveBuildDto) => o.url != null)
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url?: string;
}

/**
 * POST /storefront/build-chats — one turn of the build-assistant chat. The maker
 * input is whichever of `text` / `url` is present, OR an attached `image` file
 * part (handled by the controller's FileInterceptor, not this DTO). `chatId`
 * appends to an existing chat; absent → a new chat is lazily created.
 */
export class SendBuildChatDto {
  @IsOptional()
  @IsString()
  chatId?: string;

  @IsEnum(BuildChatMode)
  mode!: BuildChatMode;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url?: string;
}

/** True when the checkout is a delivery (vs pickup) — gates address validation. */
function isDelivery(o: CheckoutDto): boolean {
  return o.fulfillmentType === FulfillmentType.DELIVERY;
}

/**
 * POST /storefront/checkout — 3-step checkout, submitted as multipart/form-data
 * (carries the payment proof file). Creates a PENDING Order + PENDING Payment.
 *
 * Contact + payment fields are always required. Address fields are required only
 * for DELIVERY; `branchId` only for PICKUP. Form fields arrive as strings.
 */
export class CheckoutDto {
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shipName!: string;

  /** Mobile number — always required, snapshotted to Order.shipPhone. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  shipPhone!: string;

  @IsEnum(FulfillmentType)
  fulfillmentType!: FulfillmentType;

  /* ----- Pickup ----- */
  @ValidateIf((o: CheckoutDto) => o.fulfillmentType === FulfillmentType.PICKUP)
  @IsString()
  @IsNotEmpty()
  branchId?: string;

  /* ----- Delivery address (required when DELIVERY) ----- */
  @ValidateIf(isDelivery)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  shipLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipLine2?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shipBarangay?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shipCity?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shipProvince?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shipRegion?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  shipPostal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipCountry?: string;

  /* ----- Address ref codes (denormalized for re-resolve; optional) ----- */
  @IsOptional() @IsString() @MaxLength(20) regionCode?: string;
  @IsOptional() @IsString() @MaxLength(20) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @IsOptional() @IsString() @MaxLength(20) barangayCode?: string;

  /* ----- Payment (always required) ----- */
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  reference!: string;
}
