import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Importación masiva de datos avanzados de un partido. Estas tres tablas existen en el esquema
// pero no tenían forma de cargarse, y su volumen (cientos/miles de filas por partido) descarta la
// carga a mano: por eso se cargan por lote desde un archivo/planilla del proveedor.
//
// En los tres casos el jugador debe figurar en la alineación del partido: de ahí se deriva su
// equipo. Nunca se adivina a qué equipo pertenece.

/** Una métrica avanzada (xG, xA, PPDA, Field Tilt…) de un equipo O de un jugador. */
export class AdvancedMetricRowDto {
  @IsOptional() @IsInt() playerId?: number | null;
  @IsOptional() @IsInt() teamId?: number | null;

  @IsString() @MaxLength(50) metricName!: string;
  @IsNumber() metricValue!: number;

  @IsOptional() @IsString() @MaxLength(50) provider?: string | null;
  @IsOptional() @IsString() @MaxLength(50) modelVersion?: string | null;
}

export class ImportAdvancedMetricsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => AdvancedMetricRowDto)
  rows!: AdvancedMetricRowDto[];
}

/** Una muestra de posición de un jugador (para mapa de calor / posición media). */
export class PlayerPositionRowDto {
  @IsInt() playerId!: number;

  @IsOptional() @IsString() @MaxLength(20) period?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(200) minute?: number | null;

  // Coordenadas normalizadas 0-100, igual criterio que el resto del sistema.
  @IsNumber() @Min(0) @Max(100) posX!: number;
  @IsNumber() @Min(0) @Max(100) posY!: number;

  @IsOptional() @IsNumber() @Min(0) weight?: number | null;
  @IsOptional() @IsString() @MaxLength(50) source?: string | null;
}

export class ImportPlayerPositionsDto {
  @IsArray()
  @ArrayNotEmpty()
  // Un partido con muestreo por minuto y 22 jugadores ronda las 2.000 filas; se deja margen.
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => PlayerPositionRowDto)
  rows!: PlayerPositionRowDto[];
}

/** Datos físicos (GPS) de un jugador en el partido. */
export class PlayerPhysicalRowDto {
  @IsInt() playerId!: number;

  @IsOptional() @IsNumber() @Min(0) distanceKm?: number | null;
  @IsOptional() @IsNumber() @Min(0) topSpeedKmh?: number | null;
  @IsOptional() @IsInt() @Min(0) stepsCount?: number | null;
  @IsOptional() @IsInt() @Min(0) sprintsCount?: number | null;
  @IsOptional() @IsInt() @Min(0) accelerations?: number | null;
  @IsOptional() @IsInt() @Min(0) decelerations?: number | null;
  @IsOptional() @IsNumber() @Min(0) walkDistanceKm?: number | null;
  @IsOptional() @IsNumber() @Min(0) jogDistanceKm?: number | null;
  @IsOptional() @IsNumber() @Min(0) runDistanceKm?: number | null;
  @IsOptional() @IsNumber() @Min(0) sprintDistanceKm?: number | null;
  @IsOptional() @IsString() @MaxLength(50) dataSource?: string | null;
}

export class ImportPlayerPhysicalDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlayerPhysicalRowDto)
  rows!: PlayerPhysicalRowDto[];
}
