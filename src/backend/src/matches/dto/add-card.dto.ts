import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CARD_TYPES, EVENT_PERIODS } from '../constants';

export class AddCardDto {
  @IsInt() teamId!: number;
  @IsInt() playerId!: number;
  @IsIn(CARD_TYPES) cardType!: string;
  @IsOptional() @IsInt() @Min(0) @Max(150) minute?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(60) minuteExtra?: number | null;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
  @IsOptional() @IsString() @MaxLength(200) reason?: string | null;
}
