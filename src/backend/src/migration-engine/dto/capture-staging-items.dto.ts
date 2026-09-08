import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

// Validación deliberadamente sólo de "sobre" acá (entityType conocido, rawPayload es un objeto) --
// la forma interna exacta por entityType (ver types.ts) la valida/coerciona NormalizationService,
// no la capa HTTP. Motivo: un lote de captura real mezcla items válidos e inválidos (una fila con un
// dato faltante no debe tirar abajo las otras 40 del mismo lote) -- un @ValidateNested estricto acá
// rechazaría el POST completo con un 400 en vez de dejar que cada item avance o quede en 'error'
// de forma independiente, que es el comportamiento que pide el pipeline (§"Integridad"/"Transacciones"
// del pedido: cada lote se valida y registra, nunca todo-o-nada a nivel de captura).
const ENTITY_TYPES = [
  'competition', 'season', 'team', 'venue', 'player', 'official', 'coach',
  'player_team_history', 'coach_team_history', 'match', 'lineup', 'goal', 'card', 'penalty', 'match_team_stats',
] as const;

export class CaptureStagingItemDto {
  @IsIn(ENTITY_TYPES)
  entityType!: (typeof ENTITY_TYPES)[number];

  @IsOptional() @IsString() @MaxLength(300) sourceRef?: string;

  @IsObject()
  rawPayload!: Record<string, unknown>;
}

export class CaptureStagingItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CaptureStagingItemDto)
  items!: CaptureStagingItemDto[];
}
