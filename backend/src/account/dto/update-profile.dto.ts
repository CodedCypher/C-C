import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Update the signed-in customer's own profile. All fields optional (partial
 * update). Names live on `User`; phone/company/marketingOptIn on
 * `CustomerProfile`.
 */
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}
