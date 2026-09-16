import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Conjunto fijo de posiciones, a nivel de aplicación (no CHECK en base de datos) — mismo criterio
// que competition_type/sport/status: la estructura real de catálogos la dará el futuro módulo de
// Configuración/Parametrización. Documentado como pendiente en
// docs/ANALISIS_INICIAL_LEAGUECORE.md (changelog del módulo Jugadores).
export const PLAYER_POSITIONS = ['Portero', 'Defensor', 'Mediocampista', 'Delantero'] as const;
export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export class CreatePlayerDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional() @IsISO8601() dateOfBirth?: string | null;
  @IsOptional() @IsString() @MaxLength(120) birthPlace?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string | null;
  @IsOptional() @IsIn(PLAYER_POSITIONS) position?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(99) squadNumber?: number | null;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightCm?: number | null;
  @IsOptional() @IsInt() @Min(30) @Max(200) weightKg?: number | null;
  @IsOptional()
  @IsIn(['VIGENTE', 'POR_VENCER', 'VENCIDO', 'A_PRESTAMO', 'LIBRE', 'JUVENIL'])
  contractStatus?: string | null;
  @IsOptional() @IsIn(['izquierdo', 'derecho', 'ambidiestro']) preferredFoot?: string | null;
  @IsOptional() @IsInt() teamId?: number | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsString() @MaxLength(500) photoUrl?: string | null;
}
