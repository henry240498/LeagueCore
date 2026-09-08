import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PLAYER_POSITIONS } from './create-player.dto';

export class UpdatePlayerDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsISO8601() dateOfBirth?: string | null;
  @IsOptional() @IsString() @MaxLength(120) birthPlace?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string | null;
  @IsOptional() @IsIn(PLAYER_POSITIONS) position?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(99) squadNumber?: number | null;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightCm?: number | null;
  @IsOptional() @IsIn(['izquierdo', 'derecho', 'ambidiestro']) preferredFoot?: string | null;
  @IsOptional() @IsInt() teamId?: number | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string | null;
}
