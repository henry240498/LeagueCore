import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EVENT_PERIODS } from '../constants';

export class AddFoulDto {
  @IsInt() teamId!: number;
  @IsOptional() @IsInt() playerId?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(150) minute?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) minuteExtra?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
  @IsOptional() @IsInt() cardId?: number | null;
  @IsOptional() @IsString() @MaxLength(200) note?: string | null;
}
