import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

// Mecánica de seguimiento de una corrida de sincronización (crear, contar, loguear, registrar
// errores/conflictos) -- extraído de FileImportService al construir el segundo conector real
// (TheSportsDB) para no duplicar la misma lógica dos veces; ambos conectores comparten esto, cada
// uno agrega su propia lógica de qué importar y cómo.
export type SyncCounterColumn = 'total_analyzed' | 'total_new' | 'total_updated' | 'total_unchanged' | 'total_conflicts';

const ENTITY_NAME_QUERY: Record<string, string> = {
  competition: 'SELECT name FROM dbo.competitions WHERE id = @id',
  team: 'SELECT name FROM dbo.teams WHERE id = @id',
  player: 'SELECT full_name AS name FROM dbo.players WHERE id = @id',
};

@Injectable()
export class SyncRunTracker {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async createRun(sourceCode: string, scope: Record<string, unknown>, isSimulation: boolean, userId: number, currentStage?: string) {
    const result = await this.pool
      .request()
      .input('source_code', sql.NVarChar, sourceCode)
      .input('scope_json', sql.NVarChar, JSON.stringify(scope))
      .input('is_simulation', sql.Bit, isSimulation)
      .input('started_by_user_id', sql.Int, userId)
      .input('current_stage', sql.NVarChar, currentStage ?? null)
      .query(
        `INSERT INTO dbo.sync_runs (source_code, scope_json, status, is_simulation, started_by_user_id, started_at, current_stage)
         OUTPUT INSERTED.id
         VALUES (@source_code, @scope_json, 'running', @is_simulation, @started_by_user_id, SYSUTCDATETIME(), @current_stage)`,
      );
    return result.recordset[0].id as number;
  }

  async setStage(runId: number, stage: string, pct?: number) {
    const request = this.pool.request().input('id', sql.Int, runId).input('stage', sql.NVarChar, stage);
    if (pct !== undefined) {
      request.input('pct', sql.Decimal(5, 2), pct);
      await request.query('UPDATE dbo.sync_runs SET current_stage = @stage, current_stage_pct = @pct WHERE id = @id');
    } else {
      await request.query('UPDATE dbo.sync_runs SET current_stage = @stage WHERE id = @id');
    }
  }

  // Checkpoint reanudable, guardado dentro del propio scope_json de la corrida (bajo la clave
  // `checkpoint`) en vez de agregar una columna nueva -- lo usa el primer conector genuinamente de
  // larga duración (RSSSF, procesa año por año) para poder reanudar desde el último año completado
  // en vez de arrancar de cero. Genérico: cualquier conector futuro de este estilo puede reusarlo.
  async saveCheckpoint(runId: number, checkpoint: Record<string, unknown>) {
    const current = await this.pool.request().input('id', sql.Int, runId).query('SELECT scope_json FROM dbo.sync_runs WHERE id = @id');
    const scope = current.recordset[0]?.scope_json ? JSON.parse(current.recordset[0].scope_json) : {};
    scope.checkpoint = checkpoint;
    await this.pool.request().input('id', sql.Int, runId).input('scope_json', sql.NVarChar, JSON.stringify(scope)).query(
      'UPDATE dbo.sync_runs SET scope_json = @scope_json WHERE id = @id',
    );
  }

  // Devuelve { cancelRequested, pauseRequested } -- los conectores de larga duración deben
  // consultarlo entre bloques (ej. entre años) para reaccionar de verdad a pausar/cancelar, algo
  // que los conectores anteriores (acotados a segundos) nunca necesitaron hacer.
  async getControlFlags(runId: number): Promise<{ cancelRequested: boolean; pauseRequested: boolean }> {
    const result = await this.pool
      .request()
      .input('id', sql.Int, runId)
      .query('SELECT cancel_requested, pause_requested FROM dbo.sync_runs WHERE id = @id');
    const row = result.recordset[0];
    return { cancelRequested: !!row?.cancel_requested, pauseRequested: !!row?.pause_requested };
  }

  // dbo.sync_run_stages existe desde el motor genérico original (migración 020) pero hasta acá
  // nunca tuvo un escritor real -- los conectores que la habrían usado (RSSSF/TheSportsDB/etc.) se
  // borraron antes de necesitarla. El motor de migración histórica (migration-engine/) es el primer
  // llamador real: una fila por fase (Competiciones/Temporadas/Equipos/...), con processed_items
  // avanzando a medida que el pipeline compromete cada item -- de ahí sale la barra de progreso por
  // fase real que pide el cliente, sin inventar una tabla nueva para lo mismo.
  async initStages(runId: number, stages: { name: string; sortOrder: number; totalItems?: number }[]) {
    for (const stage of stages) {
      await this.pool
        .request()
        .input('run_id', sql.Int, runId)
        .input('stage_name', sql.NVarChar, stage.name)
        .input('sort_order', sql.Int, stage.sortOrder)
        .input('total_items', sql.Int, stage.totalItems ?? null)
        .query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.sync_run_stages WHERE sync_run_id = @run_id AND stage_name = @stage_name)
           INSERT INTO dbo.sync_run_stages (sync_run_id, stage_name, sort_order, status, total_items)
           VALUES (@run_id, @stage_name, @sort_order, 'pending', @total_items)`,
        );
    }
  }

  async startStage(runId: number, stageName: string, totalItems?: number) {
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('stage_name', sql.NVarChar, stageName)
      .input('total_items', sql.Int, totalItems ?? null)
      .query(
        `UPDATE dbo.sync_run_stages SET status = 'running', total_items = COALESCE(@total_items, total_items), started_at = COALESCE(started_at, SYSUTCDATETIME())
         WHERE sync_run_id = @run_id AND stage_name = @stage_name`,
      );
  }

  async advanceStage(runId: number, stageName: string, processedDelta: number) {
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('stage_name', sql.NVarChar, stageName)
      .input('delta', sql.Int, processedDelta)
      .query(`UPDATE dbo.sync_run_stages SET processed_items = processed_items + @delta WHERE sync_run_id = @run_id AND stage_name = @stage_name`);
  }

  async finishStage(runId: number, stageName: string) {
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('stage_name', sql.NVarChar, stageName)
      .query(`UPDATE dbo.sync_run_stages SET status = 'completed', finished_at = SYSUTCDATETIME() WHERE sync_run_id = @run_id AND stage_name = @stage_name`);
  }

  async setStatus(runId: number, status: 'running' | 'paused') {
    await this.pool.request().input('id', sql.Int, runId).input('status', sql.NVarChar, status).query(
      `UPDATE dbo.sync_runs SET status = @status, pause_requested = CASE WHEN @status = 'paused' THEN 1 ELSE pause_requested END WHERE id = @id`,
    );
  }

  async finishRun(runId: number, status: 'completed' | 'failed' | 'cancelled') {
    await this.pool
      .request()
      .input('id', sql.Int, runId)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE dbo.sync_runs SET status = @status, finished_at = SYSUTCDATETIME() WHERE id = @id`);
  }

  async bumpCounter(runId: number, column: SyncCounterColumn) {
    await this.pool.request().input('id', sql.Int, runId).query(`UPDATE dbo.sync_runs SET ${column} = ${column} + 1 WHERE id = @id`);
  }

  async log(runId: number, level: 'info' | 'success' | 'warning' | 'error', message: string, entityType?: string, entityLabel?: string) {
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('level', sql.NVarChar, level)
      .input('message', sql.NVarChar, message)
      .input('entity_type', sql.NVarChar, entityType ?? null)
      .input('entity_label', sql.NVarChar, entityLabel ?? null)
      .query(
        `INSERT INTO dbo.sync_log_entries (sync_run_id, level, message, entity_type, entity_label)
         VALUES (@run_id, @level, @message, @entity_type, @entity_label)`,
      );
  }

  async recordError(runId: number, entityType: string, resourceRef: string, errorType: string, message: string) {
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('entity_type', sql.NVarChar, entityType)
      .input('resource_ref', sql.NVarChar, resourceRef)
      .input('error_type', sql.NVarChar, errorType)
      .input('message', sql.NVarChar, message)
      .query(
        `INSERT INTO dbo.sync_errors (sync_run_id, entity_type, resource_ref, error_type, message)
         VALUES (@run_id, @entity_type, @resource_ref, @error_type, @message)`,
      );
    await this.pool.request().input('id', sql.Int, runId).query('UPDATE dbo.sync_runs SET total_errors = total_errors + 1 WHERE id = @id');
    await this.log(runId, 'error', `${resourceRef}: ${message}`, entityType);
  }

  async recordConflict(
    runId: number,
    entityType: string,
    existingId: number | null,
    externalId: string,
    externalValue: string,
    similarityPct: number,
    context?: Record<string, unknown>,
  ) {
    const query = ENTITY_NAME_QUERY[entityType];
    const existingName =
      existingId && query ? (await this.pool.request().input('id', sql.Int, existingId).query(query)).recordset[0]?.name : null;
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('entity_type', sql.NVarChar, entityType)
      .input('leaguecore_entity_id', sql.Int, existingId)
      .input('external_id', sql.NVarChar, externalId)
      .input('leaguecore_value', sql.NVarChar, existingName)
      .input('external_value', sql.NVarChar, externalValue)
      .input('similarity_pct', sql.Decimal(5, 2), similarityPct)
      .input('context_json', sql.NVarChar, context ? JSON.stringify(context) : null)
      .query(
        `INSERT INTO dbo.sync_conflicts (sync_run_id, entity_type, leaguecore_entity_id, external_id, leaguecore_value, external_value, similarity_pct, context_json)
         VALUES (@run_id, @entity_type, @leaguecore_entity_id, @external_id, @leaguecore_value, @external_value, @similarity_pct, @context_json)`,
      );
  }

  // Distinto de recordConflict: no es "¿son la misma entidad?" sino "es la MISMA entidad (mismo
  // torneo/temporada/fecha/equipos) pero con algún campo distinto" -- ej. resultado 2-1 importado
  // como 3-1. `existingDisplay`/`importedDisplay` son objetos planos etiqueta->valor para mostrar el
  // diff campo a campo en la UI (§11 del pedido: nunca "existe conflicto" a secas); `importedApply`
  // son los valores crudos (columnas reales) que se escribirían si el admin elige "usar importado".
  async recordFieldDiffConflict(
    runId: number,
    entityType: string,
    existingEntityId: number,
    existingDisplay: Record<string, unknown>,
    importedDisplay: Record<string, unknown>,
    importedApply: Record<string, unknown>,
  ) {
    await this.pool
      .request()
      .input('run_id', sql.Int, runId)
      .input('entity_type', sql.NVarChar, entityType)
      .input('leaguecore_entity_id', sql.Int, existingEntityId)
      .input('leaguecore_value', sql.NVarChar, JSON.stringify(existingDisplay))
      .input('external_value', sql.NVarChar, JSON.stringify({ display: importedDisplay, apply: importedApply }))
      .query(
        `INSERT INTO dbo.sync_conflicts (sync_run_id, entity_type, leaguecore_entity_id, leaguecore_value, external_value, conflict_kind)
         VALUES (@run_id, @entity_type, @leaguecore_entity_id, @leaguecore_value, @external_value, 'field_diff')`,
      );
  }
}
