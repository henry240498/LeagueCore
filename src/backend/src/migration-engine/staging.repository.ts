import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import type { EntityType, MatchVerdict, PipelineStatus, StagingItemRow } from './types';

function toCamel(r: Record<string, any>): StagingItemRow {
  return {
    id: r.id,
    syncRunId: r.sync_run_id,
    entityType: r.entity_type,
    sourceRef: r.source_ref,
    rawPayload: r.raw_payload,
    normalizedPayload: r.normalized_payload,
    pipelineStatus: r.pipeline_status,
    matchVerdict: r.match_verdict,
    matchedEntityId: r.matched_entity_id,
    committedEntityId: r.committed_entity_id,
    syncConflictId: r.sync_conflict_id,
    errorMessage: r.error_message,
    capturedAt: r.captured_at,
    processedAt: r.processed_at,
  };
}

// Acceso a dbo.migration_staging_items compartido por todas las etapas del pipeline (normalización/
// matching/reconciliación/validación/commit) -- una sola pieza que sabe leer/escribir la cola, cada
// etapa sólo sabe qué hacer con el contenido, no cómo persistir el avance. Mismo criterio que
// SyncRunTracker para dbo.sync_runs.
@Injectable()
export class StagingRepository {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async capture(syncRunId: number, entityType: EntityType, rawPayload: unknown, sourceRef?: string | null): Promise<number> {
    const result = await this.pool
      .request()
      .input('sync_run_id', sql.Int, syncRunId)
      .input('entity_type', sql.NVarChar, entityType)
      .input('source_ref', sql.NVarChar, sourceRef ?? null)
      .input('raw_payload', sql.NVarChar, JSON.stringify(rawPayload))
      .query(
        `INSERT INTO dbo.migration_staging_items (sync_run_id, entity_type, source_ref, raw_payload)
         OUTPUT INSERTED.id
         VALUES (@sync_run_id, @entity_type, @source_ref, @raw_payload)`,
      );
    return result.recordset[0].id as number;
  }

  async getById(id: number): Promise<StagingItemRow | null> {
    const result = await this.pool.request().input('id', sql.BigInt, id).query('SELECT * FROM dbo.migration_staging_items WHERE id = @id');
    return result.recordset[0] ? toCamel(result.recordset[0]) : null;
  }

  // Trae el próximo lote pendiente de una etapa, en orden de captura -- FIFO simple, sin prioridad
  // (el orden de fases ya lo impone quien llama, filtrando por entityType en la secuencia acordada).
  async nextBatch(syncRunId: number, status: PipelineStatus, entityType: EntityType | null, limit: number): Promise<StagingItemRow[]> {
    const request = this.pool.request().input('sync_run_id', sql.Int, syncRunId).input('status', sql.NVarChar, status).input('limit', sql.Int, limit);
    let where = 'sync_run_id = @sync_run_id AND pipeline_status = @status';
    if (entityType) {
      request.input('entity_type', sql.NVarChar, entityType);
      where += ' AND entity_type = @entity_type';
    }
    const result = await request.query(`SELECT TOP (@limit) * FROM dbo.migration_staging_items WHERE ${where} ORDER BY id`);
    return result.recordset.map(toCamel);
  }

  // Visibilidad/depuración -- lista items de una corrida, opcionalmente filtrados por estado (ej.
  // "mostrame los que quedaron en error" desde el panel de progreso).
  async listByRun(syncRunId: number, status?: PipelineStatus, limit = 500): Promise<StagingItemRow[]> {
    const request = this.pool.request().input('sync_run_id', sql.Int, syncRunId).input('limit', sql.Int, limit);
    let where = 'sync_run_id = @sync_run_id';
    if (status) { request.input('status', sql.NVarChar, status); where += ' AND pipeline_status = @status'; }
    const result = await request.query(`SELECT TOP (@limit) * FROM dbo.migration_staging_items WHERE ${where} ORDER BY id DESC`);
    return result.recordset.map(toCamel);
  }

  async countByStatus(syncRunId: number): Promise<Record<PipelineStatus, number>> {
    const result = await this.pool
      .request()
      .input('sync_run_id', sql.Int, syncRunId)
      .query('SELECT pipeline_status, COUNT(*) AS n FROM dbo.migration_staging_items WHERE sync_run_id = @sync_run_id GROUP BY pipeline_status');
    const counts = {} as Record<PipelineStatus, number>;
    for (const row of result.recordset) counts[row.pipeline_status as PipelineStatus] = row.n;
    return counts;
  }

  async setNormalized(id: number, normalizedPayload: unknown) {
    await this.pool
      .request()
      .input('id', sql.BigInt, id)
      .input('normalized_payload', sql.NVarChar, JSON.stringify(normalizedPayload))
      .query(`UPDATE dbo.migration_staging_items SET normalized_payload = @normalized_payload, pipeline_status = 'normalized' WHERE id = @id`);
  }

  async setMatched(id: number, verdict: MatchVerdict, matchedEntityId: number | null) {
    await this.pool
      .request()
      .input('id', sql.BigInt, id)
      .input('verdict', sql.NVarChar, verdict)
      .input('matched_entity_id', sql.Int, matchedEntityId)
      .query(
        `UPDATE dbo.migration_staging_items SET match_verdict = @verdict, matched_entity_id = @matched_entity_id, pipeline_status = 'matched' WHERE id = @id`,
      );
  }

  async setConflict(id: number, syncConflictId: number) {
    await this.pool
      .request()
      .input('id', sql.BigInt, id)
      .input('conflict_id', sql.Int, syncConflictId)
      .query(`UPDATE dbo.migration_staging_items SET pipeline_status = 'conflict', sync_conflict_id = @conflict_id WHERE id = @id`);
  }

  async setStatus(id: number, status: PipelineStatus) {
    await this.pool.request().input('id', sql.BigInt, id).input('status', sql.NVarChar, status).query(
      `UPDATE dbo.migration_staging_items SET pipeline_status = @status WHERE id = @id`,
    );
  }

  async setError(id: number, message: string) {
    await this.pool
      .request()
      .input('id', sql.BigInt, id)
      .input('message', sql.NVarChar, message.slice(0, 1000))
      .query(`UPDATE dbo.migration_staging_items SET pipeline_status = 'error', error_message = @message WHERE id = @id`);
  }

  async setCommitted(id: number, committedEntityId: number) {
    await this.pool
      .request()
      .input('id', sql.BigInt, id)
      .input('committed_entity_id', sql.Int, committedEntityId)
      .query(
        `UPDATE dbo.migration_staging_items SET pipeline_status = 'committed', committed_entity_id = @committed_entity_id, processed_at = SYSUTCDATETIME() WHERE id = @id`,
      );
  }

  // Resuelve el id de producción de un staging item ya comprometido -- lo usan las etapas de tipos
  // dependientes (ej. 'lineup' necesita el team_id/player_id ya comprometidos por 'team'/'player')
  // para no tener que volver a resolver por nombre cada vez.
  async findCommittedByPayloadMatch(syncRunId: number, entityType: EntityType, predicate: (payload: any) => boolean): Promise<number | null> {
    const result = await this.pool
      .request()
      .input('sync_run_id', sql.Int, syncRunId)
      .input('entity_type', sql.NVarChar, entityType)
      .query(
        `SELECT normalized_payload, committed_entity_id FROM dbo.migration_staging_items
         WHERE sync_run_id = @sync_run_id AND entity_type = @entity_type AND pipeline_status = 'committed'`,
      );
    for (const row of result.recordset) {
      const payload = row.normalized_payload ? JSON.parse(row.normalized_payload) : null;
      if (payload && predicate(payload)) return row.committed_entity_id;
    }
    return null;
  }
}
