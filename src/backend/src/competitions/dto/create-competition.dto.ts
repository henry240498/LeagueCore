import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(50) competitionType?: string;
  @IsOptional() @IsString() @MaxLength(50) sport?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsString() @MaxLength(150) organization?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) observations?: string;

  @IsOptional() @IsInt() @Min(1900) @Max(2200) seasonYear?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) pointsWin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) pointsDraw?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) pointsLoss?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) autoPromotionSlots?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) autoRelegationSlots?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) promotionPlayoffSlots?: number;
  @IsOptional() @IsInt() @Min(0) @Max(255) relegationPlayoffSlots?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) matchDurationMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) periodsPerMatch?: number;
}
