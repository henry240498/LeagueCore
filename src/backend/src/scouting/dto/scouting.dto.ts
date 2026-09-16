import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveRivalProfileDto {
  @IsOptional() @IsString() @MaxLength(10) usualFormation?: string | null;
  @IsOptional() @IsString() strengths?: string | null;
  @IsOptional() @IsString() weaknesses?: string | null;
  @IsOptional() @IsString() @MaxLength(500) buildup?: string | null;
  @IsOptional() @IsString() @MaxLength(500) pressing?: string | null;
  @IsOptional() @IsString() @MaxLength(500) transitions?: string | null;
  @IsOptional() @IsString() @MaxLength(500) setPieces?: string | null;
  @IsOptional() @IsString() offensivePatterns?: string | null;
  @IsOptional() @IsString() defensivePatterns?: string | null;
  @IsOptional() @IsString() @MaxLength(500) dangerousPlayers?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

export class CreateRivalReportDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() content?: string | null;
  @IsOptional() @IsString() @MaxLength(150) createdBy?: string | null;
}

export class CreateScoutingReportDto {
  @IsOptional() @IsInt() playerId?: number | null;
  @IsOptional() @IsString() @MaxLength(200) externalName?: string | null;
  @IsOptional() @IsString() @MaxLength(30) position?: string | null;
  @IsOptional() @IsString() strengths?: string | null;
  @IsOptional() @IsString() weaknesses?: string | null;
  @IsOptional() @IsIn(['FICHAR', 'SEGUIR', 'DESCARTAR']) recommendation?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(10) rating?: number | null;
  @IsOptional() @IsString() @MaxLength(150) scoutName?: string | null;
  @IsOptional() @IsISO8601() reportDate?: string | null;
}

export class CreateWatchItemDto {
  @IsOptional() @IsInt() playerId?: number | null;
  @IsOptional() @IsString() @MaxLength(200) externalName?: string | null;
  @IsOptional() @IsIn(['ALTA', 'MEDIA', 'BAJA']) priority?: string;
  @IsOptional() @IsIn(['OBSERVADO', 'EN_SEGUIMIENTO', 'OFERTADO', 'DESCARTADO']) status?: string;
  @IsOptional() @IsString() @MaxLength(150) owner?: string | null;
  @IsOptional() @IsISO8601() lastObservation?: string | null;
  @IsOptional() @IsISO8601() nextObservation?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}

export class UpdateWatchItemDto {
  @IsOptional() @IsIn(['ALTA', 'MEDIA', 'BAJA']) priority?: string;
  @IsOptional() @IsIn(['OBSERVADO', 'EN_SEGUIMIENTO', 'OFERTADO', 'DESCARTADO']) status?: string;
  @IsOptional() @IsString() @MaxLength(150) owner?: string | null;
  @IsOptional() @IsISO8601() lastObservation?: string | null;
  @IsOptional() @IsISO8601() nextObservation?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}
