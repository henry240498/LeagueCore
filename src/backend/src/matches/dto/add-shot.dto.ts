import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EVENT_PERIODS } from '../constants';

export const SHOT_OUTCOMES = ['saved', 'blocked', 'off_target', 'post'] as const;

export class AddShotDto {
  @IsInt() teamId!: number;
  @IsInt() playerId!: number;
  @IsOptional() @IsInt() @Min(0) @Max(150) minute?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) minuteExtra?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
  @IsNumber() @Min(0) @Max(100) posX!: number;
  @IsNumber() @Min(0) @Max(100) posY!: number;
  @IsIn(SHOT_OUTCOMES) outcome!: string;
  @IsOptional() @IsString() @MaxLength(20) bodyPart?: string | null;
  @IsOptional() @IsNumber() @Min(0) @Max(1) xg?: number | null;
}
