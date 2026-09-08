import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EVENT_PERIODS } from '../constants';

export class AddOffsideDto {
  @IsInt() teamId!: number;
  @IsOptional() @IsInt() playerId?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(150) minute?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) minuteExtra?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
}
