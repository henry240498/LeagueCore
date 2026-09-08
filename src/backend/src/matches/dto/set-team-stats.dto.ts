import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

// Todos opcionales/NULL-able a propósito: la ausencia de un valor es "sin datos", nunca 0
// (criterio "cero real vs. desconocido" pedido explícitamente para el módulo Partidos).
export class SetTeamStatsDto {
  @IsOptional() @IsNumber() @Min(0) possessionPct?: number | null;
  @IsOptional() @IsInt() @Min(0) shots?: number | null;
  @IsOptional() @IsInt() @Min(0) shotsOnTarget?: number | null;
  @IsOptional() @IsInt() @Min(0) shotsOffTarget?: number | null;
  @IsOptional() @IsInt() @Min(0) shotsBlocked?: number | null;
  @IsOptional() @IsInt() @Min(0) corners?: number | null;
  @IsOptional() @IsInt() @Min(0) fouls?: number | null;
  @IsOptional() @IsInt() @Min(0) offsidesCount?: number | null;
  @IsOptional() @IsInt() @Min(0) throwIns?: number | null;
  @IsOptional() @IsInt() @Min(0) goalKicks?: number | null;
  @IsOptional() @IsInt() @Min(0) freeKicksDirect?: number | null;
  @IsOptional() @IsInt() @Min(0) freeKicksIndirect?: number | null;
  @IsOptional() @IsInt() @Min(0) passes?: number | null;
  @IsOptional() @IsInt() @Min(0) passesCompleted?: number | null;
  @IsOptional() @IsInt() @Min(0) touches?: number | null;
}
