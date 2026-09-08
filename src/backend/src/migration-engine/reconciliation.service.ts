import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { normalizeText } from '../research/name-match.util';
import { StagingRepository } from './staging.repository';
import type { StagingItemRow } from './types';

// Campos realmente enriquecibles por tipo -- comparar sólo lo que Registro Fútbol puede aportar
// (ver payloads en types.ts), nunca inventar un campo a diffear que la fuente no ofrece.
const ENRICHABLE: Record<string, { field: string; column: string; isDate?: boolean }[]> = {
  player: [
    { field: 'dateOfBirth', column: 'date_of_birth', isDate: true },
    { field: 'nationality', column: 'nationality' },
    { field: 'position', column: 'position' },
  ],
  official: [
    { field: 'dateOfBirth', column: 'date_of_birth', isDate: true },
    { field: 'nationality', column: 'nationality' },
  ],
  coach: [{ field: 'nationality', column: 'nationality' }],
};

const TABLE_BY_TYPE: Record<string, string> = { player: 'players', official: 'officials', coach: 'coaches' };

// Dado el veredicto de MigrationMatcherService, decide qué pasa con cada staging item:
//  - 'new': nada que reconciliar, avanza tal cual a validación/commit (se crea entidad nueva ahí).
//  - 'ambiguous': NUNCA se auto-fusiona (regla explícita del pedido) -- se registra un
//    dbo.sync_conflicts real (duplicate_entity) con todo el contexto necesario para que, si un
//    admin decide "crear como nuevo", ConflictResolutionService pueda hacerlo sin que falte nada
//    (corrige el gap real encontrado en el motor de investigación, donde a un jugador ambiguo le
//    faltaba el teamId en el contexto).
//  - 'same': se compara campo a campo contra la fila existente -- lo que ya está y coincide, no
//    genera nada; lo que está vacío se completa (marcado en el propio commit, no acá); lo que
//    CONTRADICE un valor ya cargado queda como conflicto de campo (field_diff), nunca se pisa solo.
@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly staging: StagingRepository,
    private readonly tracker: SyncRunTracker,
  ) {}

  async reconcile(item: StagingItemRow, matchScore = 0): Promise<void> {
    if (item.pipelineStatus !== 'matched' || !item.matchVerdict) return;

    if (item.matchVerdict === 'ambiguous') {
      const payload: any = JSON.parse(item.normalizedPayload ?? item.rawPayload);
      const label = this.labelFor(item.entityType, payload);
      const conflictEntityType = item.entityType === 'player_team_history' ? 'player' : item.entityType;
      await this.tracker.bumpCounter(item.syncRunId, 'total_conflicts');
      await this.tracker.recordConflict(
        item.syncRunId,
        conflictEntityType,
        item.matchedEntityId,
        // dbo.sync_conflicts.external_id es NVARCHAR(100) (migración 020, pensado para un id corto
        // tipo Wikidata Q-id) -- sourceRef acá puede ser una URL descriptiva larga, se trunca
        // defensivamente en vez de dejar que un INSERT real trunque con un error SQL sin capturar
        // (bug real encontrado en la Fase 0: un sourceRef de ~108 caracteres tiraba abajo la corrida
        // completa con un 500 sin explicación). La referencia completa igual queda en context_json.
        (item.sourceRef ?? '').slice(0, 100),
        label,
        matchScore,
        { stagingItemId: item.id, payload, source: 'registrofutbol', sourceRef: item.sourceRef ?? null },
      );
      // El id real del conflicto recién creado -- SyncRunTracker no lo devuelve, se busca el último
      // para esta corrida/entidad (mismo patrón ya usado en otras partes del proyecto para evitar
      // tocar la firma de un servicio compartido por dos motores).
      const created = await this.pool
        .request()
        .input('run_id', sql.Int, item.syncRunId)
        .query(`SELECT TOP 1 id FROM dbo.sync_conflicts WHERE sync_run_id = @run_id ORDER BY id DESC`);
      await this.staging.setConflict(item.id, created.recordset[0].id);
      await this.tracker.log(item.syncRunId, 'warning', `Posible duplicado: ${label}`, item.entityType, label);
      return;
    }

    if (item.matchVerdict === 'same' && ENRICHABLE[item.entityType] && item.matchedEntityId) {
      await this.reconcileFieldDiffs(item);
    }

    await this.staging.setStatus(item.id, 'reconciled');
  }

  private async reconcileFieldDiffs(item: StagingItemRow) {
    const payload: any = JSON.parse(item.normalizedPayload ?? item.rawPayload);
    const table = TABLE_BY_TYPE[item.entityType];
    const fields = ENRICHABLE[item.entityType];
    const current = await this.pool.request().input('id', sql.Int, item.matchedEntityId).query(`SELECT * FROM dbo.${table} WHERE id = @id`);
    const row = current.recordset[0];
    if (!row) return;

    for (const { field, column, isDate } of fields) {
      const newVal = payload[field];
      if (newVal === undefined || newVal === null || newVal === '') continue;
      const oldVal = row[column];
      if (oldVal === undefined || oldVal === null || oldVal === '') continue; // vacío se completa en el commit, no es un conflicto
      const oldStr = isDate ? String(oldVal).slice(0, 10) : normalizeText(String(oldVal));
      const newStr = isDate ? String(newVal).slice(0, 10) : normalizeText(String(newVal));
      if (oldStr !== newStr) {
        await this.tracker.recordFieldDiffConflict(item.syncRunId, item.entityType, item.matchedEntityId!, { [field]: oldVal }, { [field]: newVal }, { [field]: newVal });
        await this.tracker.log(item.syncRunId, 'warning', `Dato existente distinto al de Registro Fútbol (${field})`, item.entityType, `${row.first_name ?? row.name} ${row.last_name ?? ''}`.trim());
      }
    }
  }

  private labelFor(entityType: string, payload: any): string {
    if (payload.firstName) return `${payload.firstName} ${payload.lastName}`;
    if (payload.name) return payload.name;
    return entityType;
  }
}
