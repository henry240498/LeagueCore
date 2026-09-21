import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TOURNAMENT_FORMATS, TOURNAMENT_STATUSES } from './create-informal-tournament.dto';

export class UpdateInformalTournamentDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(50) sport?: string;
  @IsOptional() @IsIn([...TOURNAMENT_FORMATS]) format?: string;
  @IsOptional() @IsIn([...TOURNAMENT_STATUSES]) status?: string;
  @IsOptional() @IsString() @MaxLength(150) location?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsInt() @Min(2) @Max(256) maxTeams?: number;
  @IsOptional() @IsString() @MaxLength(150) organizer?: string;
  @IsOptional() @IsString() @MaxLength(150) contact?: string;
  @IsOptional() @IsString() @MaxLength(4000) participants?: string;
  @IsOptional() @IsString() @MaxLength(1000) observations?: string;
}
