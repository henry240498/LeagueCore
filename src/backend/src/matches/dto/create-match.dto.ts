import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MATCH_STATUSES } from '../constants';

export class CreateMatchDto {
  @IsInt() competitionId!: number;
  @IsInt() seasonId!: number;
  @IsInt() homeTeamId!: number;
  @IsInt() awayTeamId!: number;

  @IsISO8601() matchDate!: string;

  @IsOptional() @IsString() @MaxLength(8) matchTime?: string | null;
  @IsOptional() @IsInt() venueId?: number | null;
  @IsOptional() @IsIn(MATCH_STATUSES) status?: string;
  @IsOptional() @IsInt() @Min(0) attendance?: number | null;
  @IsOptional() @IsString() @MaxLength(50) round?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phase?: string | null;
  @IsOptional() @IsString() @MaxLength(20) groupName?: string | null;
  @IsOptional() @IsIn(['ida', 'vuelta']) leg?: string | null;

  @IsOptional() @IsString() @MaxLength(30) weatherCondition?: string | null;
  @IsOptional() @IsNumber() @Min(-50) @Max(60) temperatureCelsius?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(100) humidityPct?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(300) windKmh?: number | null;
  @IsOptional() @IsString() @MaxLength(30) pitchCondition?: string | null;

  @IsOptional() @IsString() @MaxLength(1000) comments?: string | null;
}
