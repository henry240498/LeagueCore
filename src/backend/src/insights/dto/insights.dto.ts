import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_ENTITIES = ['MATCH', 'PLAYER', 'TEAM'] as const;

export const REPORT_SECTIONS: Record<string, string[]> = {
  MATCH: ['RESULTADO', 'GOLES', 'TIROS_XG', 'MAPA_TIROS', 'POSESIONES', 'BALON_PARADO', 'CAMBIOS', 'RESUMEN_IA'],
  PLAYER: ['FICHA', 'TECNICA', 'FISICO', 'LESIONES', 'GOLES', 'OBJETIVOS'],
  TEAM: ['CONTEXTO', 'DISCIPLINA', 'OBJETIVOS', 'RACHA', 'GOLEADORES'],
};

export class CreateTemplateDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsIn([...REPORT_ENTITIES])
  entity!: string;

  @IsString()
  sectionsJson!: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() sectionsJson?: string;
}
