import { IsIn, IsInt } from 'class-validator';
import { MATCH_OFFICIAL_ROLES } from '../constants';

export class AddMatchOfficialDto {
  @IsInt() officialId!: number;
  @IsIn(MATCH_OFFICIAL_ROLES) role!: string;
}
