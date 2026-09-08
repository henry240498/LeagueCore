import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { EVENT_PERIODS, FORMATION_SHAPES } from '../constants';

export class SetMatchFormationDto {
  @IsInt() teamId!: number;
  @IsIn(FORMATION_SHAPES) formationShape!: string;
  @IsOptional() @IsIn(EVENT_PERIODS) period?: string | null;
  @IsOptional() @IsString() source?: string | null;
}
