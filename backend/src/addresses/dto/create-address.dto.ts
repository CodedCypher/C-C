import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Create a saved delivery address for the signed-in shopper. Built from the
 * checkout's cascading PH dropdowns — names are stored for display, the ref
 * codes for re-resolve. `phone` is the contact mobile.
 */
export class CreateAddressDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(40) phone!: string;

  @IsString() @IsNotEmpty() @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;

  @IsString() @IsNotEmpty() @MaxLength(120) barangay!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) city!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) province!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) region!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) postalCode!: string;
  @IsOptional() @IsString() @MaxLength(120) country?: string;

  @IsOptional() @IsString() @MaxLength(20) regionCode?: string;
  @IsOptional() @IsString() @MaxLength(20) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @IsOptional() @IsString() @MaxLength(20) barangayCode?: string;

  @IsOptional() @IsBoolean() isDefault?: boolean;
}
