import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PLAYER_POSITIONS } from '../../players/dto/create-player.dto';

export class AddLineupEntryDto {
  @IsInt() teamId!: number;
  @IsInt() playerId!: number;
  @IsOptional() @IsBoolean() isStarting?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(99) shirtNumber?: number | null;
  @IsOptional() @IsIn(PLAYER_POSITIONS) position?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(150) minutesPlayed?: number | null;
}
