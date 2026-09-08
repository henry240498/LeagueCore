import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { StagingRepository } from './staging.repository';
import type { EntityType, StagingItemRow } from './types';

// Tabla real por tipo -- sólo para los tipos "de catálogo" que tienen una fila propia a verificar;
// los tipos de relación/evento no tienen esta pregunta (su integridad se resuelve al buscar sus
// dependencias en CommitService, que ya falla con claridad -- 'error' con motivo -- si algo no
// existe, no hace falta duplicar esa lógica acá).
const ENTITY_TABLE: Partial<Record<EntityType, string>> = {
  competition: 'competitions', season: 'seasons', team: 'teams', venue: 'venues',
  player: 'players', official: 'officials', coach: 'coaches',
};

// Gate de integridad antes de comprometer -- mismo principio que usó el script de deduplicación de
// equipos (verificar ANTES de escribir, no confiar ciegamente en lo resuelto minutos antes), acá
// adaptado a un caso real y concreto: entre que el matcher resolvió `matchedEntityId` y que este
// item llega a comprometerse, la fila podría haber sido borrada por otra operación concurrente
// (admin, u otro staging item de este mismo run resolviendo un conflicto de fusión). Validar esto
// puntualmente en vez de una revisión genérica de FKs -- las dependencias de los tipos de
// relación/evento las valida CommitService al resolverlas, no hace falta repetir el trabajo acá.
@Injectable()
export class ValidationService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool, private readonly staging: StagingRepository) {}

  async validate(item: StagingItemRow): Promise<boolean> {
    if (item.pipelineStatus !== 'reconciled') return false;

    if (item.matchVerdict === 'same' && item.matchedEntityId) {
      const table = ENTITY_TABLE[item.entityType];
      if (table) {
        const exists = await this.pool.request().input('id', sql.Int, item.matchedEntityId).query(`SELECT 1 FROM dbo.${table} WHERE id = @id`);
        if (exists.recordset.length === 0) {
          await this.staging.setError(item.id, 'La entidad coincidente ya no existe (fue eliminada después del matching) -- se necesita volver a capturar este item');
          return false;
        }
      }
    }

    await this.staging.setStatus(item.id, 'validated');
    return true;
  }
}
