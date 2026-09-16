import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CLUB_STATUSES } from './create-club.dto';

export class UpdateClubDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(20) shortName?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsInt() @Min(1800) @Max(2200) foundedYear?: number;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/) primaryColor?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/) secondaryColor?: string;
  @IsOptional() @IsString() history?: string;
  @IsOptional() @IsIn([...CLUB_STATUSES]) status?: string;
}
