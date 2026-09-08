import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { SHOOTOUT_OUTCOMES } from '../constants';

export class AddShootoutKickDto {
  @IsInt() teamId!: number;
  @IsOptional() @IsInt() playerId?: number | null;
  @IsInt() @Min(1) kickOrder!: number;
  @IsIn(SHOOTOUT_OUTCOMES) outcome!: string;
}
