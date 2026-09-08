import { Injectable } from '@nestjs/common';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { CommitService } from './commit.service';
import { MigrationMatcherService } from './migration-matcher.service';
import { NormalizationService } from './normalization.service';
import { ReconciliationService } from './reconciliation.service';
import { StagingRepository } from './staging.repository';
import type { EntityType } from './types';
import { ValidationService } from './validation.service';

// Orden real de fases (ver plan técnico aprobado) -- respeta las dependencias FK del esquema real:
// nada de un tipo se procesa hasta que todo lo "captured" del tipo anterior ya está comprometido o
// en error/conflicto. Coincide con el orden de 15 fases propuesto por el cliente, colapsado a los
// entityType reales del staging (Rankings/Público no son entityType propios -- son consultas
// derivadas sobre lo ya migrado, no algo que este pipeline escriba).
export const PHASE_ORDER: EntityType[] = [
  'competition', 'season', 'team', 'venue', 'player', 'player_team_history',
  'coach', 'coach_team_history', 'official', 'match', 'lineup', 'goal', 'card', 'penalty', 'match_team_stats',
];

const BATCH_SIZE = 25;

// Motor automático de la mitad NORMALIZACIÓN→MATCHING→RECONCILIACIÓN→VALIDACIÓN→COMMIT del
// pipeline (ver plan técnico) -- a diferencia de la CAPTURA (siempre supervisada), esta mitad opera
// 100% contra la propia base de LeagueCore, así que puede procesar todo el backlog capturado de una
// corrida sin ningún límite de "cortesía" hacia un sitio externo. Procesa un item a la vez, de
// principio a fin, antes de pasar al siguiente -- nunca por lotes desacoplados por etapa -- para que
// el matching de un item vea ya comprometidos los items anteriores del mismo run (ej.: un equipo
// recién creado por un item de tipo 'team' debe ser visible para el siguiente item de tipo 'match'
// que lo referencia, sin depender de que ambos hayan sido, por casualidad, capturados en el orden
// correcto).
@Injectable()
export class PipelineRunnerService {
  constructor(
    private readonly staging: StagingRepository,
    private readonly normalization: NormalizationService,
    private readonly matcher: MigrationMatcherService,
    private readonly reconciliation: ReconciliationService,
    private readonly validation: ValidationService,
    private readonly commit: CommitService,
    private readonly tracker: SyncRunTracker,
  ) {}

  async process(runId: number): Promise<{ processed: number; stoppedEarly: boolean }> {
    await this.tracker.initStages(runId, PHASE_ORDER.map((name, i) => ({ name, sortOrder: i + 1 })));

    let processed = 0;
    try {
      for (const entityType of PHASE_ORDER) {
        const flags = await this.tracker.getControlFlags(runId);
        if (flags.cancelRequested) return { processed, stoppedEarly: true };
        if (flags.pauseRequested) { await this.tracker.setStatus(runId, 'paused'); return { processed, stoppedEarly: true }; }

        await this.tracker.setStage(runId, entityType);
        await this.tracker.startStage(runId, entityType);

        let batch = await this.staging.nextBatch(runId, 'captured', entityType, BATCH_SIZE);
        while (batch.length > 0) {
          for (const item of batch) {
            await this.processOne(runId, item.id, entityType);
            processed++;
            // El propio bookkeeping (avance de etapa) puede fallar bajo la misma presión que un
            // item individual -- no debe tumbar la corrida por eso, procesar ya ocurrió de verdad.
            try { await this.tracker.advanceStage(runId, entityType, 1); } catch { /* sólo cosmético para la barra de progreso */ }
          }
          const flagsMid = await this.tracker.getControlFlags(runId);
          if (flagsMid.cancelRequested) return { processed, stoppedEarly: true };
          if (flagsMid.pauseRequested) { await this.tracker.setStatus(runId, 'paused'); return { processed, stoppedEarly: true }; }
          batch = await this.staging.nextBatch(runId, 'captured', entityType, BATCH_SIZE);
        }
        await this.tracker.finishStage(runId, entityType);
      }
    } catch (err: any) {
      // Red de seguridad final: si algo en el propio bucle de fases (no en el procesamiento de un
      // item puntual, ya aislado arriba) falla igual bajo carga sostenida, se corta la corrida acá
      // en vez de devolver un 500 genérico que no deja ningún rastro de cuánto se alcanzó a hacer.
      // Llamar process() de nuevo retoma exactamente donde quedó -- todo lo comprometido hasta acá
      // sigue comprometido, sólo falta reintentar el resto.
      try { await this.tracker.log(runId, 'error', `process() se detuvo antes de tiempo: ${err?.message ?? 'error desconocido'}`); } catch { /* idem */ }
      return { processed, stoppedEarly: true };
    }
    return { processed, stoppedEarly: false };
  }

  private async processOne(runId: number, stagingItemId: number, entityType: EntityType): Promise<void> {
    // Bug real encontrado migrando el catálogo completo de 425 equipos (7427 items): una excepción
    // sin capturar en CUALQUIER etapa (normalización/matching/reconciliación/validación -- sólo
    // CommitService ya tenía su propio try/catch) tumbaba la llamada process() COMPLETA con un 500
    // genérico, dejando cientos de items sin procesar sin ningún registro de qué falló ni por qué.
    // Un lote de miles de items real necesita que UN item roto no tumbe todo el lote -- se aísla acá,
    // por item, igual que ya hacía CommitService.commit() para la etapa de compromiso.
    try {
      let item = await this.staging.getById(stagingItemId);
      if (!item) return;

      const norm = this.normalization.normalize(entityType, JSON.parse(item.rawPayload));
      if (!norm.ok) {
        await this.staging.setError(item.id, norm.error ?? 'Dato inválido');
        await this.tracker.recordError(runId, entityType, String(item.id), 'normalization_error', norm.error ?? 'Dato inválido');
        return;
      }
      await this.staging.setNormalized(item.id, norm.payload);

      item = await this.staging.getById(stagingItemId);
      if (!item) return;
      const outcome = await this.matcher.match(item);
      await this.staging.setMatched(item.id, outcome.verdict, outcome.matchedEntityId);

      item = await this.staging.getById(stagingItemId);
      if (!item) return;
      await this.reconciliation.reconcile(item, outcome.score);

      item = await this.staging.getById(stagingItemId);
      if (!item || item.pipelineStatus !== 'reconciled') return; // 'conflict' -- se detiene acá, espera resolución de un admin

      const valid = await this.validation.validate(item);
      if (!valid) return;

      item = await this.staging.getById(stagingItemId);
      if (!item) return;
      await this.commit.commit(item);
    } catch (err: any) {
      // Bug real (2da vuelta): el catch de arriba solo no alcanzaba -- bajo carga sostenida
      // (miles de items seguidos) el propio registro del error (setError/recordError, ambos
      // consultas SQL) podía fallar por la MISMA razón de fondo (ej. pool de conexiones bajo
      // presión), y esa segunda excepción SÍ se propagaba sin capturar, tumbando process() igual
      // que antes. Un manejador de errores que él mismo puede fallar no es un manejador de errores
      // real -- se envuelve también, en el peor caso se pierde silenciosamente el mensaje puntual
      // de ESTE item pero jamás la corrida completa.
      const message = err?.message ?? 'Error desconocido en el pipeline';
      try {
        await this.staging.setError(stagingItemId, message);
        await this.tracker.recordError(runId, entityType, String(stagingItemId), 'pipeline_error', message);
      } catch { /* ver comentario arriba -- no dejar que el registro del error tumbe la corrida */ }
    }
  }
}
