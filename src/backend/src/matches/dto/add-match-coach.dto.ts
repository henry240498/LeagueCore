import { IsIn, IsInt, IsOptional } from 'class-validator';
import { COACH_ROLES } from '../constants';

export class AddMatchCoachDto {
  @IsInt() teamId!: number;
  @IsInt() coachId!: number;
  @IsOptional() @IsIn(COACH_ROLES) role?: string;
}
