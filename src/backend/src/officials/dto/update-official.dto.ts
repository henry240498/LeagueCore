import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOfficialDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsISO8601() dateOfBirth?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string | null;
  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsInt() officialTypeId?: number | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string | null;
}
