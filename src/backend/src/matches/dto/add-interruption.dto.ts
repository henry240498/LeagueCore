import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EVENT_PERIODS, INTERRUPTION_TYPES } from '../constants';

export class AddInterruptionDto {
  @IsIn(INTERRUPTION_TYPES) interruptionType!: string;
  @IsOptional() @IsInt() @Min(0) @Max(150) minuteStart?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(150) minuteEnd?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
  @IsOptional() @IsString() @MaxLength(300) reason?: string | null;
}
