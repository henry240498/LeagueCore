import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const CLUB_STATUSES = ['active', 'inactive'] as const;

export class CreateClubDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional() @IsString() @MaxLength(20) shortName?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsInt() @Min(1800) @Max(2200) foundedYear?: number;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor debe ser hex (#RRGGBB)' }) primaryColor?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor debe ser hex (#RRGGBB)' }) secondaryColor?: string;
  @IsOptional() @IsString() history?: string;
  @IsOptional() @IsIn([...CLUB_STATUSES]) status?: string;
}
