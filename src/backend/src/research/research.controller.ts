import { Body, Controller, Get, Inject, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { SyncRunsService } from '../import-engine/sync-runs.service';
import { StartResearchRunDto } from './dto/start-research-run.dto';
import { SubmitResearchedOfficialDto } from './dto/submit-researched-official.dto';
import { SubmitResearchedPlayerDto } from './dto/submit-researched-player.dto';
import { OfficialResearchService } from './official-research.service';
import { PlayerResearchService } from './player-research.service';
import { ProvenanceService } from './provenance.service';

const RESEARCH_SOURCE_CODE = 'historical_research';

class FinishRunDto {
  @IsIn(['completed', 'failed', 'cancelled'])
  status!: 'completed' | 'failed' | 'cancelled';
}

// Motor de Investigación Histórica -- la ejecución real del "descubrimiento" (buscar en fuentes
// públicas) la hace un agente de forma explícita y supervisada por corrida, nunca un crawler
// autónomo sin supervisión (decisión de arquitectura ya presentada y aprobada). Este controlador es
// la parte real y funcionando: crea la corrida, recibe cada entidad ya investigada y normalizada, y
// deja que PlayerResearchService/OfficialResearchService hagan el matching/enriquecimiento/
// relaciones/procedencia reales contra la base.
@Controller('research')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class ResearchController {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly runs: SyncRunsService,
    private readonly tracker: SyncRunTracker,
    private readonly playerResearch: PlayerResearchService,
    private readonly officialResearch: OfficialResearchService,
  ) {}

  @Get('runs')
  listRuns() {
    return this.runs.listRuns(RESEARCH_SOURCE_CODE);
  }

  @Get('runs/:id')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.runs.getRunDetail(id);
  }

  @Post('runs')
  async startRun(@Body() dto: StartResearchRunDto, @Req() req: AuthenticatedRequest) {
    const run = await this.runs.createRun(RESEARCH_SOURCE_CODE, dto as any, false, req.user!.id);
    await this.pool
      .request()
      .input('id', sql.Int, run.id)
      .query(`UPDATE dbo.sync_runs SET status = 'running', started_at = SYSUTCDATETIME() WHERE id = @id`);
    await this.tracker.setStage(run.id, 'investigando', 0);
    return this.runs.getRun(run.id);
  }

  @Patch('runs/:id/finish')
  async finishRun(@Param('id', ParseIntPipe) id: number, @Body() dto: FinishRunDto) {
    await this.tracker.finishRun(id, dto.status);
    return this.runs.getRun(id);
  }

  @Post('runs/:id/players')
  submitPlayer(@Param('id', ParseIntPipe) id: number, @Body() dto: SubmitResearchedPlayerDto) {
    return this.playerResearch.submit(id, dto);
  }

  @Post('runs/:id/officials')
  submitOfficial(@Param('id', ParseIntPipe) id: number, @Body() dto: SubmitResearchedOfficialDto) {
    return this.officialResearch.submit(id, dto);
  }
}
