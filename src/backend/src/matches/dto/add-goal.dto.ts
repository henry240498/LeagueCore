import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { EVENT_PERIODS, GOAL_TYPES } from '../constants';

export class AddGoalDto {
  @IsInt() teamId!: number;
  @IsInt() playerId!: number;
  @IsOptional() @IsInt() assistPlayerId?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(150) minute?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) minuteExtra?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
  @IsOptional() @IsBoolean() ownGoal?: boolean;
  @IsOptional() @IsBoolean() penalty?: boolean;
  @IsOptional() @IsIn(GOAL_TYPES) goalType?: string | null;
  @IsOptional() @IsNumber() @Min(0) @Max(100) posX?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(100) posY?: number | null;
}
