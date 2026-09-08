import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EVENT_PERIODS, PENALTY_OUTCOMES } from '../constants';

export class AddPenaltyKickDto {
  @IsInt() teamId!: number;
  @IsInt() playerId!: number;
  @IsIn(PENALTY_OUTCOMES) outcome!: string;
  @IsOptional() @IsInt() @Min(0) @Max(150) minute?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) minuteExtra?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
}
