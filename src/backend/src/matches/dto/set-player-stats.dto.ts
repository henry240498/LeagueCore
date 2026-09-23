import { IsInt, IsOptional, Min } from 'class-validator';

// Estadísticas individuales de un jugador en un partido (dbo.match_player_stats).
//
// Mismo criterio que SetTeamStatsDto: todos opcionales/NULL-able a propósito — la ausencia de un
// valor significa "sin datos", nunca 0. Un 0 real (p. ej. cero remates) se carga explícitamente.
//
// Sólo se incluyen las columnas que la tabla realmente tiene: no se agregan métricas que no existan
// en el esquema (xG, rating, regates, etc. no viven acá).
export class SetPlayerStatsDto {
  @IsOptional() @IsInt() @Min(0) shots?: number | null;
  @IsOptional() @IsInt() @Min(0) shotsOnTarget?: number | null;
  @IsOptional() @IsInt() @Min(0) passes?: number | null;
  @IsOptional() @IsInt() @Min(0) passesCompleted?: number | null;
  @IsOptional() @IsInt() @Min(0) touches?: number | null;
  @IsOptional() @IsInt() @Min(0) tackles?: number | null;
  @IsOptional() @IsInt() @Min(0) tacklesWon?: number | null;
  @IsOptional() @IsInt() @Min(0) interceptions?: number | null;
  @IsOptional() @IsInt() @Min(0) clearances?: number | null;
  @IsOptional() @IsInt() @Min(0) recoveries?: number | null;
  @IsOptional() @IsInt() @Min(0) duelsGroundWon?: number | null;
  @IsOptional() @IsInt() @Min(0) duelsGroundLost?: number | null;
  @IsOptional() @IsInt() @Min(0) duelsAerialWon?: number | null;
  @IsOptional() @IsInt() @Min(0) duelsAerialLost?: number | null;
  @IsOptional() @IsInt() @Min(0) blocksShots?: number | null;
  @IsOptional() @IsInt() @Min(0) blocksPasses?: number | null;
}
