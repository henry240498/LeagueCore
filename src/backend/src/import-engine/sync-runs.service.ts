import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import type { SyncScope } from './types';

function toCamelRun(r: Record<string, any>) {
  return {
    id: r.id,
    sourceCode: r.source_code,
    scope: r.scope_json ? JSON.parse(r.scope_json) : null,
    status: r.status,
    isSimulation: !!r.is_simulation,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    startedByUserId: r.started_by_user_id,
    startedByUsername: r.started_by_username,
    currentStage: r.current_stage,
    currentStagePct: r.current_stage_pct,
    totalAnalyzed: r.total_analyzed,
    totalNew: r.total_new,
    totalUpdated: r.total_updated,
    totalUnchanged: r.total_unchanged,
    totalIgnored: r.total_ignored,
    totalConflicts: r.total_conflicts,
    totalErrors: r.total_errors,
    cancelRequested: !!r.cancel_requested,
    pauseRequested: !!r.pause_requested,
    createdAt: r.created_at,
  };
}

// Para conflictos 'field_diff' (mismo registro, algún campo distinto -- ej. resultado 2-1 vs 3-1),
// leaguecore_value/external_value guardan JSON en vez de un nombre plano (ver
// SyncRunTracker.recordFieldDiffConflict): se parsean acá para que el frontend pueda dibujar el
// diff campo a campo directamente, sin tener que hacer JSON.parse en la UI ni conocer el formato
// interno. Un parseo que falla (conflicto viejo 'duplicate_entity', formato plano) se ignora --
// existingDisplay/importedDisplay quedan null y la UI cae al render de nombre simple.
function toCamelConflict(c: Record<string, any>) {
  const isFieldDiff = c.conflict_kind === 'field_diff';
  let existingDisplay: Record<string, unknown> | null = null;
  let importedDisplay: Record<string, unknown> | null = null;
  if (isFieldDiff) {
    try {
      existingDisplay = c.leaguecore_value ? JSON.parse(c.leaguecore_value) : null;
    } catch {
      existingDisplay = null;
    }
    try {
      importedDisplay = c.external_value ? JSON.parse(c.external_value)?.display ?? null : null;
    } catch {
      importedDisplay = null;
    }
  }
  return {
    id: c.id,
    entityType: c.entity_type,
    conflictKind: c.conflict_kind,
    leaguecoreEntityId: c.leaguecore_entity_id,
    externalId: c.external_id,
    leaguecoreValue: c.leaguecore_value,
    externalValue: c.external_value,
    existingDisplay,
    importedDisplay,
    similarityPct: c.similarity_pct,
    status: c.status,
    resolutionAction: c.resolution_action,
    context: c.context_json ? safeJsonParse(c.context_json) : null,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
  };
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

@Injectable()
export class SyncRunsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async listSources() {
    const result = await this.pool.request().query('SELECT * FROM dbo.sync_sources ORDER BY name');
    return result.recordset.map((r) => ({
      code: r.code,
      name: r.name,
      status: r.status,
      statusReason: r.status_reason,
    }));
  }

  async listRuns(sourceCode?: string) {
    const request = this.pool.request();
    let where = '';
    if (sourceCode) {
      request.input('source_code', sql.NVarChar, sourceCode);
      where = 'WHERE r.source_code = @source_code';
    }
    const result = await request.query(
      `SELECT r.*, u.username AS started_by_username
       FROM dbo.sync_runs r
       JOIN dbo.users u ON u.id = r.started_by_user_id
       ${where}
       ORDER BY r.created_at DESC`,
    );
    return result.recordset.map(toCamelRun);
  }

  async getRun(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT r.*, u.username AS started_by_username
         FROM dbo.sync_runs r
         JOIN dbo.users u ON u.id = r.started_by_user_id
         WHERE r.id = @id`,
      );
    if (result.recordset.length === 0) throw new NotFoundException('Sincronización no encontrada');
    return toCamelRun(result.recordset[0]);
  }

  async getRunDetail(id: number) {
    const run = await this.getRun(id);
    const [stages, conflicts, errors, log] = await Promise.all([
      this.pool.request().input('id', sql.Int, id).query(
        'SELECT * FROM dbo.sync_run_stages WHERE sync_run_id = @id ORDER BY sort_order',
      ),
      this.pool.request().input('id', sql.Int, id).query(
        'SELECT * FROM dbo.sync_conflicts WHERE sync_run_id = @id ORDER BY id DESC',
      ),
      this.pool.request().input('id', sql.Int, id).query(
        'SELECT * FROM dbo.sync_errors WHERE sync_run_id = @id ORDER BY id DESC',
      ),
      this.pool.request().input('id', sql.Int, id).query(
        'SELECT TOP 100 * FROM dbo.sync_log_entries WHERE sync_run_id = @id ORDER BY id DESC',
      ),
    ]);
    return {
      ...run,
      stages: stages.recordset.map((s) => ({
        id: s.id,
        stageName: s.stage_name,
        sortOrder: s.sort_order,
        status: s.status,
        totalItems: s.total_items,
        processedItems: s.processed_items,
        startedAt: s.started_at,
        finishedAt: s.finished_at,
      })),
      conflicts: conflicts.recordset.map(toCamelConflict),
      errors: errors.recordset.map((e) => ({
        id: e.id,
        entityType: e.entity_type,
        resourceRef: e.resource_ref,
        errorType: e.error_type,
        message: e.message,
        attemptCount: e.attempt_count,
        createdAt: e.created_at,
      })),
      log: log.recordset.map((l) => ({
        id: l.id,
        createdAt: l.created_at,
        level: l.level,
        message: l.message,
        entityType: l.entity_type,
        entityLabel: l.entity_label,
      })),
    };
  }

  async createRun(sourceCode: string, scope: SyncScope, isSimulation: boolean, userId: number) {
    const source = await this.pool
      .request()
      .input('code', sql.NVarChar, sourceCode)
      .query('SELECT status FROM dbo.sync_sources WHERE code = @code');
    if (source.recordset.length === 0) throw new BadRequestException('Fuente desconocida');
    if (source.recordset[0].status !== 'available') {
      throw new BadRequestException(
        'Esta fuente no está disponible para sincronizar. Ver el motivo en la lista de fuentes.',
      );
    }
    const active = await this.pool
      .request()
      .input('source_code', sql.NVarChar, sourceCode)
      .query(`SELECT TOP 1 1 FROM dbo.sync_runs WHERE source_code = @source_code AND status IN ('pending','running','paused')`);
    if (active.recordset.length > 0) {
      throw new BadRequestException('Ya existe una sincronización en ejecución para esta fuente.');
    }

    const result = await this.pool
      .request()
      .input('source_code', sql.NVarChar, sourceCode)
      .input('scope_json', sql.NVarChar, JSON.stringify(scope ?? {}))
      .input('is_simulation', sql.Bit, isSimulation)
      .input('started_by_user_id', sql.Int, userId)
      .query(
        `INSERT INTO dbo.sync_runs (source_code, scope_json, status, is_simulation, started_by_user_id)
         OUTPUT INSERTED.id
         VALUES (@source_code, @scope_json, 'pending', @is_simulation, @started_by_user_id)`,
      );
    return this.getRun(result.recordset[0].id);
  }

  // Todos los conflictos pendientes across corridas -- alimenta una vista central de "conflictos
  // por resolver" en vez de obligar a entrar corrida por corrida a buscarlos (§10 del pedido).
  async listPendingConflicts(sourceCode?: string) {
    const request = this.pool.request();
    let where = "WHERE c.status = 'pending'";
    if (sourceCode) {
      request.input('source_code', sql.NVarChar, sourceCode);
      where += ' AND r.source_code = @source_code';
    }
    const result = await request.query(
      `SELECT c.*, r.source_code, r.id AS run_id
       FROM dbo.sync_conflicts c
       JOIN dbo.sync_runs r ON r.id = c.sync_run_id
       ${where}
       ORDER BY c.id DESC`,
    );
    return result.recordset.map((c) => ({ ...toCamelConflict(c), sourceCode: c.source_code, syncRunId: c.run_id }));
  }

  async getConflictRow(id: number) {
    const result = await this.pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.sync_conflicts WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Conflicto no encontrado');
    return result.recordset[0] as Record<string, any>;
  }

  async requestPause(id: number) {
    await this.pool.request().input('id', sql.Int, id).query(
      `UPDATE dbo.sync_runs SET pause_requested = 1 WHERE id = @id AND status = 'running'`,
    );
    return this.getRun(id);
  }

  async requestResume(id: number) {
    await this.pool.request().input('id', sql.Int, id).query(
      `UPDATE dbo.sync_runs SET pause_requested = 0, status = 'running' WHERE id = @id AND status = 'paused'`,
    );
    return this.getRun(id);
  }

  async requestCancel(id: number) {
    await this.pool.request().input('id', sql.Int, id).query(
      `UPDATE dbo.sync_runs SET cancel_requested = 1 WHERE id = @id AND status IN ('running','paused','pending')`,
    );
    return this.getRun(id);
  }
}
