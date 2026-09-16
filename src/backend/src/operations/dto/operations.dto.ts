import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTrainingDto {
  @IsInt()
  teamId!: number;

  @IsISO8601()
  trainingDate!: string;

  @IsOptional() @IsInt() @Min(1) durationMin?: number | null;
  @IsOptional() @IsString() @MaxLength(300) objective?: string | null;
  @IsOptional() @IsIn(['BAJA', 'MEDIA', 'ALTA']) loadLevel?: string | null;
  @IsOptional() @IsIn(['MALO', 'REGULAR', 'BUENO', 'EXCELENTE']) performance?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) videoUrl?: string | null;
}

export class CreateExerciseDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional() @IsString() @MaxLength(50) category?: string | null;
  @IsOptional() @IsString() @MaxLength(300) objective?: string | null;
  @IsOptional() @IsString() @MaxLength(30) ageGroup?: string | null;
  @IsOptional() @IsInt() @Min(1) durationMin?: number | null;
  @IsOptional() @IsString() @MaxLength(30) playersCount?: string | null;
  @IsOptional() @IsString() @MaxLength(300) material?: string | null;
  @IsOptional() @IsString() diagram?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) videoUrl?: string | null;
  @IsOptional() @IsIn(['BAJA', 'MEDIA', 'ALTA']) intensity?: string | null;
}

export class SetAttendanceDto {
  @IsInt()
  playerId!: number;

  @IsIn(['ENTRENO', 'NO_ENTRENO', 'LESIONADO', 'SANCIONADO', 'DESCANSO', 'SELECCION', 'PERMISO'])
  status!: string;
}

export class CreateObjectiveDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional() @IsNumber() targetValue?: number | null;
  @IsOptional() @IsNumber() currentValue?: number | null;
  @IsOptional() @IsISO8601() deadline?: string | null;
  @IsOptional() @IsIn(['EN_CURSO', 'LOGRADO', 'VENCIDO']) status?: string;
}

export class UpdateObjectiveDto {
  @IsOptional() @IsNumber() currentValue?: number | null;
  @IsOptional() @IsIn(['EN_CURSO', 'LOGRADO', 'VENCIDO']) status?: string;
}
