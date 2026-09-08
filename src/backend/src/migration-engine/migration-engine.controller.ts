import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { SyncRunsService } from '../import-engine/sync-runs.service';
import { CaptureStagingItemsDto } from './dto/capture-staging-items.dto';
import { PipelineRunnerService } from './pipeline-runner.service';
import { StagingRepository } from './staging.repository';
import type { PipelineStatus } from './types';

const MIGRATION_SOURCE_CODE = 'registrofutbol_migration';

class FinishRunDto {
  @IsIn(['completed', 'failed', 'cancelled'])
  status!: 'completed' | 'failed' | 'cancelled';
}

// Motor de Migración Histórica (Registro Fútbol → LeagueCore) -- ver plan técnico aprobado.
// CAPTURA es siempre lo único manual/supervisado (POST .../capture recibe JSON ya estructurado
// durante una sesión explícita, nunca hace scraping él mismo -- ver types.ts). Todo lo demás
// (normalizar/matchear/reconciliar/validar/comprometer) corre automático vía POST .../process,
// reutilizando sync_runs/sync_conflicts/field_provenance tal cual (regla explícita del cliente:
// "NO CREAR UN SEGUNDO MOTOR"). Exclusivo de administrador, mismo guard que Investigación/Seguridad.
@Controller('migration-engine')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class MigrationEngineController {
  constructor(
    private readonly runs: SyncRunsService,
    private readonly tracker: SyncRunTracker,
    private readonly staging: StagingRepository,
    private readonly runner: PipelineRunnerService,
  ) {}

  @Get('runs')
  listRuns() {
    return this.runs.listRuns(MIGRATION_SOURCE_CODE);
  }

  @Get('runs/:id')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.runs.getRunDetail(id);
  }

  @Get('runs/:id/staging')
  listStaging(@Param('id', ParseIntPipe) id: number, @Query('status') status?: PipelineStatus) {
    return this.staging.listByRun(id, status);
  }

  @Post('runs')
  async startRun(@Req() req: AuthenticatedRequest) {
    const run = await this.runs.createRun(MIGRATION_SOURCE_CODE, {}, false, req.user!.id);
    await this.tracker.setStatus(run.id, 'running');
    return this.runs.getRun(run.id);
  }

  // CAPTURA -- recibe items ya extraídos/estructurados durante una sesión supervisada (ver
  // dto/capture-staging-items.dto.ts y types.ts). No dispara procesamiento automáticamente: capturar
  // y procesar son pasos separados a propósito (la captura es lenta/con cortesía hacia el sitio
  // externo, el procesamiento es rápido/sin límite -- ver plan técnico, "Restricción operativa").
  @Post('runs/:id/capture')
  async capture(@Param('id', ParseIntPipe) id: number, @Body() dto: CaptureStagingItemsDto) {
    const ids: number[] = [];
    for (const it of dto.items) {
      ids.push(await this.staging.capture(id, it.entityType as any, it.rawPayload, it.sourceRef));
    }
    await this.tracker.log(id, 'info', `${ids.length} item(s) capturado(s)`, undefined, undefined);
    return { captured: ids.length, stagingItemIds: ids };
  }

  // Corre NORMALIZACIÓN→MATCHING→RECONCILIACIÓN→VALIDACIÓN→COMMIT sobre todo el backlog "captured"
  // de la corrida, fase por fase. Se puede llamar varias veces (ej. tras capturar más lotes, o tras
  // resolver conflictos pendientes que hayan liberado items para reintentarse manualmente).
  @Post('runs/:id/process')
  async process(@Param('id', ParseIntPipe) id: number) {
    return this.runner.process(id);
  }

  @Post('runs/:id/pause')
  pause(@Param('id', ParseIntPipe) id: number) {
    return this.runs.requestPause(id);
  }

  @Post('runs/:id/resume')
  resume(@Param('id', ParseIntPipe) id: number) {
    return this.runs.requestResume(id);
  }

  @Post('runs/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.runs.requestCancel(id);
  }

  @Patch('runs/:id/finish')
  async finishRun(@Param('id', ParseIntPipe) id: number, @Body() dto: FinishRunDto) {
    await this.tracker.finishRun(id, dto.status);
    return this.runs.getRun(id);
  }
}
