import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Update a saved delivery address. Same fields as create but every field is
 * optional (partial update). Empty strings are rejected where present so a
 * supplied required field can't be blanked out.
 */
export class UpdateAddressDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40) phone?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) barangay?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) province?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) region?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) country?: string;

  @IsOptional() @IsString() @MaxLength(20) regionCode?: string;
  @IsOptional() @IsString() @MaxLength(20) provinceCode?: string;
  @IsOptional() @IsString() @MaxLength(20) cityCode?: string;
  @IsOptional() @IsString() @MaxLength(20) barangayCode?: string;

  @IsOptional() @IsBoolean() isDefault?: boolean;
}
