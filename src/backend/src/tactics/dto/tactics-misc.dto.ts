import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePossessionDto {
  @IsInt()
  teamId!: number;

  @IsOptional() @IsInt() @Min(0) startMinute?: number | null;
  @IsOptional() @IsInt() @Min(0) endMinute?: number | null;
  @IsOptional() @IsInt() @Min(0) passes?: number | null;
  @IsOptional() @IsInt() @Min(0) progressiveDistanceM?: number | null;
  @IsOptional() @IsString() @MaxLength(30) startZone?: string | null;
  @IsOptional() @IsString() @MaxLength(30) endZone?: string | null;
  @IsOptional()
  @IsIn(['TIRO', 'GOL', 'PERDIDA', 'FALTA_RECIBIDA', 'FALTA_COMETIDA', 'CORNER', 'SAQUE_MANOS', 'FIN_PERIODO'])
  outcome?: string | null;
  @IsOptional() @IsNumber() @Min(0) xg?: number | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}

export class CreateEventTypeDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(150)
  label!: string;

  @IsOptional() @IsString() fieldsJson?: string | null;
}

export class CreateCustomEventDto {
  @IsInt()
  teamId!: number;

  @IsOptional() @IsInt() playerId?: number | null;
  @IsString()
  @MaxLength(50)
  eventCode!: string;

  @IsOptional() @IsInt() @Min(0) minute?: number | null;
  @IsOptional() @IsString() dataJson?: string | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}

export class CreateMetricDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(500)
  formula!: string;

  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
}

export class UpdateMetricDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) formula?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
}

export class CreateSetPieceDto {
  @IsInt()
  teamId!: number;

  @IsIn(['CORNER', 'FREEKICK', 'THROWIN', 'PENALTY', 'KICKOFF'])
  kind!: string;

  @IsOptional() @IsString() @MaxLength(100) variant?: string | null;
  @IsOptional() @IsInt() @Min(0) minute?: number | null;
  @IsOptional()
  @IsIn(['GOL', 'OCASION', 'DESPEJADO', 'PERDIDA', 'REPETICION', 'SIN_RESULTADO'])
  outcome?: string | null;
  @IsOptional() @IsString() @MaxLength(30) playCode?: string | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}
