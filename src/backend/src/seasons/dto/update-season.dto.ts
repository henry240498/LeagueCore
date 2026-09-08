import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateSeasonDto {
  @IsOptional() @IsInt() competitionId?: number;
  @IsOptional() @IsInt() @Min(1900) @Max(2200) startYear?: number;
  @IsOptional() @IsInt() @Min(1900) @Max(2200) endYear?: number;
  @IsOptional() @IsISO8601() startDate?: string | null;
  @IsOptional() @IsISO8601() endDate?: string | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(1000) observations?: string | null;
}
