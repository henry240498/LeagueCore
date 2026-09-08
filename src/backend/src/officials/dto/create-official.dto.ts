import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOfficialDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsInt()
  officialTypeId!: number;

  @IsOptional() @IsISO8601() dateOfBirth?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string | null;
  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string | null;
}
