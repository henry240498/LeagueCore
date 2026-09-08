import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional() @IsInt() competitionId?: number;
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsInt() venueId?: number;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsInt() @Min(1800) @Max(2200) foundedYear?: number;
  @IsOptional() @IsString() @MaxLength(150) managerName?: string;
  @IsOptional() @IsISO8601() managerSince?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsInt() addedPoints?: number;
}
