import { IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const TECHNICAL_ATTRIBUTES = [
  'VELOCIDAD',
  'REGATE',
  'PASE_CORTO',
  'PASE_LARGO',
  'PASE_PROGRESIVO',
  'PASE_CLAVE',
  'CENTRO',
  'CONTROL',
  'CONDUCCION',
  'TIRO',
  'FINALIZACION',
  'JUEGO_AEREO',
  'BALON_PARADO',
  'RECUPERACION',
  'ENTRADA',
  'INTERCEPCION',
  'DESPEJE',
  'VISION',
  'DEFENSA',
  'FISICO',
  'PORTERIA',
] as const;

export class TechnicalRatingItem {
  @IsIn([...TECHNICAL_ATTRIBUTES])
  attribute!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  value!: number;
}

export class SaveTechnicalRatingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicalRatingItem)
  ratings!: TechnicalRatingItem[];

  @IsOptional() @IsISO8601() evaluatedAt?: string;
  @IsOptional() @IsString() @MaxLength(150) evaluator?: string;
}
