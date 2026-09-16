import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTeamDto {
  // Opcional (antes obligatorio): un club es una entidad independiente, no pertenece a una sola
  // competición para siempre -- su participación real se registra vía season_teams cuando
  // corresponde, nunca fijando una competición permanente en el club mismo.
  @IsOptional() @IsInt() competitionId?: number;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional() @IsInt() venueId?: number;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsInt() @Min(1800) @Max(2200) foundedYear?: number;
  @IsOptional() @IsString() @MaxLength(150) managerName?: string;
  @IsOptional() @IsISO8601() managerSince?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsInt() addedPoints?: number;
  // Fase 1 (clubes multi-equipo): un equipo puede pertenecer a un club con una categoria
  // (PRIMERA, RESERVA, SUB20, SUB17, FEMENINO, INFANTIL, EQUIPO_B). Ambos opcionales para no
  // romper los 475 equipos existentes.
  @IsOptional() @IsInt() clubId?: number;
  @IsOptional()
  @IsIn(['PRIMERA', 'RESERVA', 'SUB20', 'SUB17', 'FEMENINO', 'INFANTIL', 'EQUIPO_B'])
  category?: string;
}
