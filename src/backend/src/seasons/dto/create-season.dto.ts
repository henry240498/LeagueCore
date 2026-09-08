import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSeasonDto {
  @IsInt()
  competitionId!: number;

  @IsInt()
  @Min(1900)
  @Max(2200)
  startYear!: number;

  // Opcional: si no se manda, el service la iguala a startYear (temporada de un solo año).
  @IsOptional() @IsInt() @Min(1900) @Max(2200) endYear?: number;

  @IsOptional() @IsISO8601() startDate?: string | null;
  @IsOptional() @IsISO8601() endDate?: string | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(1000) observations?: string | null;
}
