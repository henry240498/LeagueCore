import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import * as sql from 'mssql';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SQL_POOL } from '../database/database.module';
import { ConflictResolutionService } from './conflict-resolution.service';
import { SyncRunsService } from './sync-runs.service';

async function audit(pool: sql.ConnectionPool, userId: number, action: string, entityId?: number, details?: string) {
  await pool
    .request()
    .input('user_id', sql.Int, userId)
    .input('action', sql.NVarChar, action)
    .input('entity', sql.NVarChar, 'sync_run')
    .input('entity_id', sql.Int, entityId ?? null)
    .input('details', sql.NVarChar, details ?? null)
    .query(
      `INSERT INTO dbo.audit_log (user_id, action, entity, entity_id, details) VALUES (@user_id, @action, @entity, @entity_id, @details)`,
    );
}

class ScopeDto {
  @IsOptional() @IsArray() @IsString({ each: true }) countries?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) competitionRefs?: string[];
  @IsOptional() @IsInt() seasonFrom?: number;
  @IsOptional() @IsInt() seasonTo?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) dataTypes?: string[];
}

class CreateRunDto {
  @IsString() sourceCode!: string;
  @IsOptional() scope?: ScopeDto;
  @IsBoolean() isSimulation!: boolean;
}

class ResolveConflictDto {
  @IsString() action!: string;
}

class ResolveConflictsBulkDto {
  @IsArray() @IsInt({ each: true }) ids!: number[];
  @IsString() action!: string;
}

// Motor GENÉRICO de corridas -- ya no tiene conectores legado (RSSSF/TheSportsDB/Ltrack/archivo
// CSV-JSON-TXT-Excel, eliminados; ver docs/ANALISIS_INICIAL_LEAGUECORE.md). Hoy la única fuente real
// que crea corridas acá es el Motor de Investigación (`research/`, código 'historical_research'),
// pero esta capa se mantiene deliberadamente genérica (seguimiento/progreso/conflictos/errores/logs)
// para no atarla a una fuente concreta -- exclusivo de administrador, mismo guard que Seguridad.
@Controller('import-sync')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class ImportEngineController {
  constructor(
    private readonly service: SyncRunsService,
    private readonly conflicts: ConflictResolutionService,
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
  ) {}

  private meta(req: AuthenticatedRequest) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Get('sources')
  listSources() {
    return this.service.listSources();
  }

  @Get('runs')
  listRuns(@Query('sourceCode') sourceCode?: string) {
    return this.service.listRuns(sourceCode);
  }

  @Get('runs/:id')
  getRunDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRunDetail(id);
  }

  @Post('runs')
  async createRun(@Body() dto: CreateRunDto, @Req() req: AuthenticatedRequest) {
    const run = await this.service.createRun(dto.sourceCode, dto.scope ?? {}, dto.isSimulation, req.user!.id);
    await audit(
      this.pool,
      req.user!.id,
      dto.isSimulation ? 'simulate_sync' : 'start_sync',
      run.id,
      `fuente: ${dto.sourceCode}`,
    );
    return run;
  }

  @Post('runs/:id/pause')
  async pause(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    const run = await this.service.requestPause(id);
    await audit(this.pool, req.user!.id, 'pause_sync', id);
    return run;
  }

  @Post('runs/:id/resume')
  async resume(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    const run = await this.service.requestResume(id);
    await audit(this.pool, req.user!.id, 'resume_sync', id);
    return run;
  }

  @Post('runs/:id/cancel')
  async cancel(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    const run = await this.service.requestCancel(id);
    await audit(this.pool, req.user!.id, 'cancel_sync', id);
    return run;
  }

  // Vista central de "conflictos por resolver" cruzando todas las corridas -- no hace falta entrar
  // corrida por corrida para encontrarlos.
  @Get('conflicts/pending')
  listPendingConflicts(@Query('sourceCode') sourceCode?: string) {
    return this.service.listPendingConflicts(sourceCode);
  }

  @Post('conflicts/:id/resolve')
  async resolveConflict(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveConflictDto, @Req() req: AuthenticatedRequest) {
    const result = await this.conflicts.resolve(id, dto.action, req.user!.id, this.meta(req));
    await audit(this.pool, req.user!.id, 'resolve_conflict', id, `acción: ${dto.action}`);
    return result;
  }

  @Post('conflicts/resolve-bulk')
  async resolveConflictsBulk(@Body() dto: ResolveConflictsBulkDto, @Req() req: AuthenticatedRequest) {
    const result = await this.conflicts.resolveBulk(dto.ids, dto.action, req.user!.id, this.meta(req));
    await audit(this.pool, req.user!.id, 'resolve_conflicts_bulk', undefined, `acción: ${dto.action}, ${result.resolved}/${result.total}`);
    return result;
  }
}
