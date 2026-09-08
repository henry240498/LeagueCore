import { IsIn, IsInt, Min } from 'class-validator';
import { RESULT_PERIODS } from '../constants';

export class SetPeriodScoreDto {
  @IsIn(RESULT_PERIODS) period!: string;
  @IsInt() @Min(0) homeScore!: number;
  @IsInt() @Min(0) awayScore!: number;
}
