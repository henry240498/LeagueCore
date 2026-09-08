import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PLAYER_POSITIONS } from '../../players/dto/create-player.dto';

// Procedencia por campo (Decisión 3, "no quiero una única fuente para toda la entidad"): cada dato
// del jugador puede citar una fuente distinta de la fuente por defecto de la corrida. Sólo se usa
// cuando el agente realmente consultó una fuente distinta para ese campo puntual -- si todo vino de
// la misma página, no hace falta llenarlo, se usa sourceName/sourceUrl de nivel superior para todo.
export class FieldSourceDto {
  @IsString() @MaxLength(150) sourceName!: string;
  @IsString() @MaxLength(500) sourceUrl!: string;
}

export class ResearchedClubStintDto {
  @IsString()
  @MaxLength(200)
  teamName!: string;

  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(150) competitionName?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) seasonYear?: number;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) squadNumber?: number;
  @IsOptional() @IsString() @MaxLength(150) sourceName?: string;
  @IsOptional() @IsString() @MaxLength(500) sourceUrl?: string;
}

// Un jugador real puede tener varios identificadores externos simultáneos (Wikidata Q-id +
// slug de Wikipedia + id de PESmaster, etc, Decisión 3) -- no uno solo.
export class AdditionalSourceDto {
  @IsString() @MaxLength(150) sourceName!: string;
  @IsString() @MaxLength(500) sourceUrl!: string;
  @IsOptional() @IsString() @MaxLength(100) externalId?: string;
}

export class SubmitResearchedPlayerDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional() @IsISO8601() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(120) birthPlace?: string;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string;
  @IsOptional() @IsIn(PLAYER_POSITIONS) position?: string;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightCm?: number;
  @IsOptional() @IsIn(['izquierdo', 'derecho', 'ambidiestro']) preferredFoot?: string;
  @IsOptional() @IsUrl() photoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ResearchedClubStintDto)
  clubs?: ResearchedClubStintDto[];

  @IsString()
  @MaxLength(150)
  sourceName!: string;

  @IsString()
  @MaxLength(500)
  sourceUrl!: string;

  @IsOptional() @IsString() @MaxLength(100) externalId?: string;

  @IsOptional()
  @IsObject()
  fieldSources?: Record<string, FieldSourceDto>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdditionalSourceDto)
  additionalSources?: AdditionalSourceDto[];
}
