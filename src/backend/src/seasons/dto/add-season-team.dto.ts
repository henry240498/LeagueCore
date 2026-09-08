import { IsInt } from 'class-validator';

export class AddSeasonTeamDto {
  @IsInt()
  teamId!: number;
}
