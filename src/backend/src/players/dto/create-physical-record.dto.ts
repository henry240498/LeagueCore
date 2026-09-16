import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePhysicalRecordDto {
  @IsOptional() @IsISO8601() recordedAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) maxSpeedKmh?: number;
  @IsOptional() @IsInt() @Min(0) @Max(60) avgSpeedKmh?: number;
  @IsOptional() @IsInt() @Min(0) distanceM?: number;
  @IsOptional() @IsInt() @Min(0) hiDistanceM?: number;
  @IsOptional() @IsInt() @Min(0) sprints?: number;
  @IsOptional() @IsInt() @Min(0) accelerations?: number;
  @IsOptional() @IsInt() @Min(0) decelerations?: number;
  @IsOptional() @IsInt() @Min(0) directionChanges?: number;
  @IsOptional() @IsInt() @Min(0) hiMinutes?: number;
  @IsOptional() @IsInt() @Min(0) playerLoad?: number;
  @IsOptional() @IsInt() @Min(0) acwr?: number;
  @IsOptional() @IsInt() @Min(30) @Max(250) heartRateAvg?: number;
  @IsOptional() @IsInt() @Min(0) externalLoad?: number;
  @IsOptional() @IsInt() @Min(0) internalLoad?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) fatigue?: number;
  @IsOptional()
  @IsIn(['DISPONIBLE', 'DUDOSO', 'LESIONADO', 'SANCIONADO', 'DESCANSO', 'SELECCION', 'PERMISO'])
  availability?: string;
  @IsOptional() @IsIn(['manual', 'gps', 'wearable', 'imported']) source?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
