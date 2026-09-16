import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreatePlayDto, UpdatePlayDto } from './dto/play.dto';
import { SaveSetupDto } from './dto/setup.dto';
import {
  CreateCustomEventDto,
  CreateEventTypeDto,
  CreateMetricDto,
  CreatePossessionDto,
  CreateSetPieceDto,
  UpdateMetricDto,
} from './dto/tactics-misc.dto';

// Zonas derivadas de coordenadas 0-100 (misma convencion que goals/shots/lineups). No se
// persisten: se calculan al leer para mapas y analisis por zonas.
export function deriveZone(posX: number, posY: number): string {
  const third = posY < 33.34 ? 'TERCIO_DEF' : posY < 66.67 ? 'MEDIO' : 'ULTIMO_TERCIO';
  const lane = posX < 33.34 ? 'IZQ' : posX < 66.67 ? 'CENTRO' : 'DER';
  return `${third}_${lane}`;
}

// Variables permitidas en formulas de metricas personalizadas.
const METRIC_VARIABLES = [
  'goles',
  'asistencias',
  'tiros',
  'xg',
  'corners',
  'faltas',
  'amarillas',
  'rojas',
  'pases',
  'recuperaciones',
  'intercepciones',
  'posesiones',
  'posesiones_xg',
] as const;

export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!/^[a-z_0-9+\-*/().\s]+$/.test(formula)) {
    throw new BadRequestException('La fórmula contiene caracteres no permitidos');
  }
  const identifiers = formula.match(/[a-z_][a-z_0-9]*/g) ?? [];
  for (const id of identifiers) {
    if (!(METRIC_VARIABLES as readonly string[]).includes(id)) {
      throw new BadRequestException(`Variable desconocida en la fórmula: ${id}`);
    }
  }
  const args = [...METRIC_VARIABLES];
  const values = args.map((a) => variables[a] ?? 0);
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(...args, `return (${formula});`);
    const result = Number(fn(...values));
    if (!Number.isFinite(result)) throw new Error('no finito');
    return Math.round(result * 100) / 100;
  } catch {
    throw new BadRequestException('La fórmula no se pudo evaluar');
  }
}

function toSetupCamel(r: Record<string, any>) {
  return {
    id: r.id,
    matchId: r.match_id,
    teamId: r.team_id,
    teamName: r.team_name ?? null,
    phase: r.phase,
    formationShape: r.formation_shape,
    block: r.block,
    pressing: r.pressing,
    buildup: r.buildup,
    notes: r.notes,
  };
}

@Injectable()
export class TacticsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // ---------- Planteos ----------
  async listSetups(matchId: number) {
    await this.assertMatchExists(matchId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT s.*, t.name AS team_name FROM dbo.match_tactical_setups s
         JOIN dbo.teams t ON t.id = s.team_id
         WHERE s.match_id = @match_id ORDER BY s.team_id, s.phase`,
      );
    return result.recordset.map(toSetupCamel);
  }

  async saveSetup(matchId: number, dto: SaveSetupDto) {
    await this.assertMatchExists(matchId);
    await this.assertTeamExists(dto.teamId);
    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('phase', sql.NVarChar, dto.phase)
      .input('formation_shape', sql.NVarChar, dto.formationShape ?? null)
      .input('block', sql.NVarChar, dto.block ?? null)
      .input('pressing', sql.NVarChar, dto.pressing ?? null)
      .input('buildup', sql.NVarChar, dto.buildup ?? null)
      .input('notes', sql.NVarChar, dto.notes ?? null)
      .query(
        `MERGE dbo.match_tactical_setups AS t
         USING (SELECT @match_id AS match_id, @team_id AS team_id, @phase AS phase) AS s
         ON t.match_id = s.match_id AND t.team_id = s.team_id AND t.phase = s.phase
         WHEN MATCHED THEN UPDATE SET formation_shape = @formation_shape, block = @block,
           pressing = @pressing, buildup = @buildup, notes = @notes, updated_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (match_id, team_id, phase, formation_shape, block, pressing, buildup, notes)
           VALUES (@match_id, @team_id, @phase, @formation_shape, @block, @pressing, @buildup, @notes);`,
      );
    return this.listSetups(matchId);
  }

  async removeSetup(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.match_tactical_setups WHERE id = @id');
  }

  // ---------- Biblioteca de jugadas ----------
  async listPlays(filters: { search?: string; category?: string }) {
    const request = this.pool.request();
    const conditions: string[] = [];
    if (filters.search) {
      request.input('search', sql.NVarChar, `%${filters.search}%`);
      conditions.push('(code LIKE @search OR title LIKE @search)');
    }
    if (filters.category) {
      request.input('category', sql.NVarChar, filters.category);
      conditions.push('category = @category');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await request.query(`SELECT * FROM dbo.tactical_plays ${where} ORDER BY code`);
    return result.recordset.map((r) => ({
      id: r.id,
      code: r.code,
      category: r.category,
      title: r.title,
      description: r.description,
      diagramJson: r.diagram_json,
      videoUrl: r.video_url,
      rival: r.rival,
      result: r.result,
      usageCount: r.usage_count,
    }));
  }

  async createPlay(dto: CreatePlayDto) {
    if (dto.diagramJson) this.assertValidJson(dto.diagramJson, 'diagramJson');
    try {
      const result = await this.pool
        .request()
        .input('code', sql.NVarChar, dto.code)
        .input('category', sql.NVarChar, dto.category)
        .input('title', sql.NVarChar, dto.title)
        .input('description', sql.NVarChar, dto.description ?? null)
        .input('diagram_json', sql.NVarChar, dto.diagramJson ?? null)
        .input('video_url', sql.NVarChar, dto.videoUrl ?? null)
        .input('rival', sql.NVarChar, dto.rival ?? null)
        .input('result', sql.NVarChar, dto.result ?? null)
        .query(
          `INSERT INTO dbo.tactical_plays (code, category, title, description, diagram_json, video_url, rival, result)
           OUTPUT INSERTED.id VALUES (@code, @category, @title, @description, @diagram_json, @video_url, @rival, @result)`,
        );
      return this.getPlay(result.recordset[0].id);
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe una jugada con ese código');
      }
      throw err;
    }
  }

  async getPlay(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.tactical_plays WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Jugada no encontrada');
    const r = result.recordset[0];
    return {
      id: r.id,
      code: r.code,
      category: r.category,
      title: r.title,
      description: r.description,
      diagramJson: r.diagram_json,
      videoUrl: r.video_url,
      rival: r.rival,
      result: r.result,
      usageCount: r.usage_count,
    };
  }

  async updatePlay(id: number, dto: UpdatePlayDto) {
    await this.getPlay(id);
    if (dto.diagramJson) this.assertValidJson(dto.diagramJson, 'diagramJson');
    const map: Record<string, string> = {
      category: 'category',
      title: 'title',
      description: 'description',
      diagramJson: 'diagram_json',
      videoUrl: 'video_url',
      rival: 'rival',
      result: 'result',
      usageCount: 'usage_count',
    };
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      const request = this.pool.request();
      const sets: string[] = [];
      for (const [camel, value] of entries) {
        const column = map[camel];
        if (!column) continue;
        request.input(column, value);
        sets.push(`${column} = @${column}`);
      }
      sets.push('updated_at = SYSUTCDATETIME()');
      request.input('id', sql.Int, id);
      await request.query(`UPDATE dbo.tactical_plays SET ${sets.join(', ')} WHERE id = @id`);
    }
    return this.getPlay(id);
  }

  async removePlay(id: number) {
    await this.getPlay(id);
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.tactical_plays WHERE id = @id');
  }

  async registerPlayUse(id: number) {
    await this.getPlay(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('UPDATE dbo.tactical_plays SET usage_count = usage_count + 1, updated_at = SYSUTCDATETIME() WHERE id = @id');
    return this.getPlay(id);
  }

  // ---------- Posesiones ----------
  async listPossessions(matchId: number) {
    await this.assertMatchExists(matchId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT p.*, t.name AS team_name FROM dbo.match_possessions p
         JOIN dbo.teams t ON t.id = p.team_id
         WHERE p.match_id = @match_id ORDER BY p.start_minute, p.id`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      matchId: r.match_id,
      teamId: r.team_id,
      teamName: r.team_name,
      startMinute: r.start_minute,
      endMinute: r.end_minute,
      passes: r.passes,
      progressiveDistanceM: r.progressive_distance_m,
      startZone: r.start_zone,
      endZone: r.end_zone,
      outcome: r.outcome,
      xg: r.xg,
      note: r.note,
    }));
  }

  async createPossession(matchId: number, dto: CreatePossessionDto) {
    await this.assertMatchExists(matchId);
    await this.assertTeamExists(dto.teamId);
    if (dto.startMinute !== undefined && dto.endMinute !== undefined && dto.endMinute < dto.startMinute) {
      throw new BadRequestException('El minuto final no puede ser anterior al inicial');
    }
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('start_minute', sql.SmallInt, dto.startMinute ?? null)
      .input('end_minute', sql.SmallInt, dto.endMinute ?? null)
      .input('passes', sql.SmallInt, dto.passes ?? null)
      .input('progressive_distance_m', sql.Int, dto.progressiveDistanceM ?? null)
      .input('start_zone', sql.NVarChar, dto.startZone ?? null)
      .input('end_zone', sql.NVarChar, dto.endZone ?? null)
      .input('outcome', sql.NVarChar, dto.outcome ?? null)
      .input('xg', sql.Decimal(4, 3), dto.xg ?? null)
      .input('note', sql.NVarChar, dto.note ?? null)
      .query(
        `INSERT INTO dbo.match_possessions
          (match_id, team_id, start_minute, end_minute, passes, progressive_distance_m, start_zone, end_zone, outcome, xg, note)
         OUTPUT INSERTED.id
         VALUES (@match_id, @team_id, @start_minute, @end_minute, @passes, @progressive_distance_m, @start_zone, @end_zone, @outcome, @xg, @note)`,
      );
    return { id: result.recordset[0].id };
  }

  async removePossession(matchId: number, possessionId: number) {
    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('id', sql.Int, possessionId)
      .query('DELETE FROM dbo.match_possessions WHERE id = @id AND match_id = @match_id');
  }

  // ---------- Eventos personalizados ----------
  async listEventTypes() {
    const result = await this.pool.query('SELECT * FROM dbo.custom_event_types ORDER BY label');
    return result.recordset.map((r) => ({ id: r.id, code: r.code, label: r.label, fieldsJson: r.fields_json }));
  }

  async createEventType(dto: CreateEventTypeDto) {
    if (dto.fieldsJson) this.assertValidJson(dto.fieldsJson, 'fieldsJson');
    try {
      const result = await this.pool
        .request()
        .input('code', sql.NVarChar, dto.code)
        .input('label', sql.NVarChar, dto.label)
        .input('fields_json', sql.NVarChar, dto.fieldsJson ?? null)
        .query(
          'INSERT INTO dbo.custom_event_types (code, label, fields_json) OUTPUT INSERTED.id VALUES (@code, @label, @fields_json)',
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe un tipo de evento con ese código');
      }
      throw err;
    }
  }

  async removeEventType(id: number) {
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.custom_event_types WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException('No se puede eliminar: ya hay eventos registrados de este tipo');
      }
      throw err;
    }
  }

  async listCustomEvents(matchId: number) {
    await this.assertMatchExists(matchId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT e.*, t.name AS team_name, p.full_name AS player_name, et.label AS event_label
         FROM dbo.match_custom_events e
         JOIN dbo.teams t ON t.id = e.team_id
         LEFT JOIN dbo.players p ON p.id = e.player_id
         JOIN dbo.custom_event_types et ON et.code = e.event_code
         WHERE e.match_id = @match_id ORDER BY e.minute, e.id`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      playerId: r.player_id,
      playerName: r.player_name,
      eventCode: r.event_code,
      eventLabel: r.event_label,
      minute: r.minute,
      dataJson: r.data_json,
      note: r.note,
    }));
  }

  async createCustomEvent(matchId: number, dto: CreateCustomEventDto) {
    await this.assertMatchExists(matchId);
    await this.assertTeamExists(dto.teamId);
    if (dto.dataJson) this.assertValidJson(dto.dataJson, 'dataJson');
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('player_id', sql.Int, dto.playerId ?? null)
      .input('event_code', sql.NVarChar, dto.eventCode)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('data_json', sql.NVarChar, dto.dataJson ?? null)
      .input('note', sql.NVarChar, dto.note ?? null)
      .query(
        `INSERT INTO dbo.match_custom_events (match_id, team_id, player_id, event_code, minute, data_json, note)
         OUTPUT INSERTED.id VALUES (@match_id, @team_id, @player_id, @event_code, @minute, @data_json, @note)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeCustomEvent(matchId: number, eventId: number) {
    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('id', sql.Int, eventId)
      .query('DELETE FROM dbo.match_custom_events WHERE id = @id AND match_id = @match_id');
  }

  // ---------- Métricas personalizadas ----------
  async listMetrics() {
    const result = await this.pool.query('SELECT * FROM dbo.custom_metrics ORDER BY name');
    return result.recordset.map((r) => ({ id: r.id, name: r.name, formula: r.formula, description: r.description }));
  }

  async createMetric(dto: CreateMetricDto) {
    evaluateFormula(dto.formula, {});
    try {
      const result = await this.pool
        .request()
        .input('name', sql.NVarChar, dto.name)
        .input('formula', sql.NVarChar, dto.formula)
        .input('description', sql.NVarChar, dto.description ?? null)
        .query(
          'INSERT INTO dbo.custom_metrics (name, formula, description) OUTPUT INSERTED.id VALUES (@name, @formula, @description)',
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe una métrica con ese nombre');
      }
      throw err;
    }
  }

  async updateMetric(id: number, dto: UpdateMetricDto) {
    if (dto.formula) evaluateFormula(dto.formula, {});
    const map: Record<string, string> = { name: 'name', formula: 'formula', description: 'description' };
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      const request = this.pool.request();
      const sets: string[] = [];
      for (const [camel, value] of entries) {
        const column = map[camel];
        if (!column) continue;
        request.input(column, value);
        sets.push(`${column} = @${column}`);
      }
      sets.push('updated_at = SYSUTCDATETIME()');
      request.input('id', sql.Int, id);
      try {
        await request.query(`UPDATE dbo.custom_metrics SET ${sets.join(', ')} WHERE id = @id`);
      } catch (err: any) {
        if (err?.number === 2601 || err?.number === 2627) {
          throw new BadRequestException('Ya existe una métrica con ese nombre');
        }
        throw err;
      }
    }
    return this.getMetric(id);
  }

  async getMetric(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.custom_metrics WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Métrica no encontrada');
    const r = result.recordset[0];
    return { id: r.id, name: r.name, formula: r.formula, description: r.description };
  }

  async removeMetric(id: number) {
    await this.getMetric(id);
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.custom_metrics WHERE id = @id');
  }

  async evaluateMetric(metricId: number, matchId: number, teamId?: number) {
    const metric = await this.getMetric(metricId);
    const variables = await this.collectMetricVariables(matchId, teamId);
    return { ...metric, variables, value: evaluateFormula(metric.formula, variables) };
  }

  // ---------- Balón parado ----------
  async listSetPieces(matchId: number) {
    await this.assertMatchExists(matchId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT s.*, t.name AS team_name FROM dbo.match_set_pieces s
         JOIN dbo.teams t ON t.id = s.team_id
         WHERE s.match_id = @match_id ORDER BY s.minute, s.id`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      kind: r.kind,
      variant: r.variant,
      minute: r.minute,
      outcome: r.outcome,
      playCode: r.play_code,
      note: r.note,
    }));
  }

  async createSetPiece(matchId: number, dto: CreateSetPieceDto) {
    await this.assertMatchExists(matchId);
    await this.assertTeamExists(dto.teamId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('kind', sql.NVarChar, dto.kind)
      .input('variant', sql.NVarChar, dto.variant ?? null)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('outcome', sql.NVarChar, dto.outcome ?? null)
      .input('play_code', sql.NVarChar, dto.playCode ?? null)
      .input('note', sql.NVarChar, dto.note ?? null)
      .query(
        `INSERT INTO dbo.match_set_pieces (match_id, team_id, kind, variant, minute, outcome, play_code, note)
         OUTPUT INSERTED.id VALUES (@match_id, @team_id, @kind, @variant, @minute, @outcome, @play_code, @note)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeSetPiece(matchId: number, setPieceId: number) {
    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('id', sql.Int, setPieceId)
      .query('DELETE FROM dbo.match_set_pieces WHERE id = @id AND match_id = @match_id');
  }

  // ---------- Mapa de tiros + xG ----------
  async getShotMap(matchId: number) {
    await this.assertMatchExists(matchId);
    const goals = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT g.id, g.team_id, g.player_id, p.full_name AS player_name, g.minute, g.pos_x, g.pos_y, g.goal_type
         FROM dbo.goals g JOIN dbo.players p ON p.id = g.player_id
         WHERE g.match_id = @match_id AND g.pos_x IS NOT NULL AND g.pos_y IS NOT NULL`,
      );
    const shots = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT s.id, s.team_id, s.player_id, p.full_name AS player_name, s.minute, s.pos_x, s.pos_y, s.outcome, s.body_part, s.xg
         FROM dbo.shots s JOIN dbo.players p ON p.id = s.player_id
         WHERE s.match_id = @match_id`,
      );
    const items = [
      ...goals.recordset.map((r) => ({
        id: `g${r.id}`,
        teamId: r.team_id,
        playerName: r.player_name,
        minute: r.minute,
        posX: Number(r.pos_x),
        posY: Number(r.pos_y),
        outcome: 'goal',
        detail: r.goal_type,
        xg: null as number | null,
        zone: deriveZone(Number(r.pos_x), Number(r.pos_y)),
      })),
      ...shots.recordset.map((r) => ({
        id: `s${r.id}`,
        teamId: r.team_id,
        playerName: r.player_name,
        minute: r.minute,
        posX: Number(r.pos_x),
        posY: Number(r.pos_y),
        outcome: r.outcome,
        detail: r.body_part,
        xg: r.xg === null ? null : Number(r.xg),
        zone: deriveZone(Number(r.pos_x), Number(r.pos_y)),
      })),
    ];
    const byTeam = new Map<number, { teamId: number; shots: number; goals: number; xg: number }>();
    for (const item of items) {
      if (!byTeam.has(item.teamId)) byTeam.set(item.teamId, { teamId: item.teamId, shots: 0, goals: 0, xg: 0 });
      const agg = byTeam.get(item.teamId)!;
      agg.shots += 1;
      if (item.outcome === 'goal') agg.goals += 1;
      if (item.xg !== null) agg.xg = Math.round((agg.xg + item.xg) * 1000) / 1000;
    }
    return { items, totals: Array.from(byTeam.values()) };
  }

  private async collectMetricVariables(matchId: number, teamId?: number): Promise<Record<string, number>> {
    await this.assertMatchExists(matchId);
    const teamFilter = teamId ? 'AND team_id = @team_id' : '';
    const req = () => {
      const r = this.pool.request().input('match_id', sql.Int, matchId);
      if (teamId) r.input('team_id', sql.Int, teamId);
      return r;
    };
    const num = (rs: any, col: string) => Number(rs.recordset[0]?.[col] ?? 0);
    const goals = num(await req().query(`SELECT COUNT(*) AS c FROM dbo.goals WHERE match_id = @match_id ${teamFilter}`), 'c');
    const assists = num(
      await req().query(`SELECT COUNT(*) AS c FROM dbo.goals WHERE match_id = @match_id AND assist_player_id IS NOT NULL ${teamFilter}`),
      'c',
    );
    const shotsOnly = num(await req().query(`SELECT COUNT(*) AS c FROM dbo.shots WHERE match_id = @match_id ${teamFilter}`), 'c');
    const xg = Number(
      (await req().query(`SELECT SUM(xg) AS s FROM dbo.shots WHERE match_id = @match_id ${teamFilter}`)).recordset[0]?.s ?? 0,
    );
    const corners = num(
      await req().query(`SELECT COUNT(*) AS c FROM dbo.match_set_pieces WHERE match_id = @match_id AND kind = 'CORNER' ${teamFilter}`),
      'c',
    );
    const fouls = num(await req().query(`SELECT COUNT(*) AS c FROM dbo.fouls WHERE match_id = @match_id ${teamFilter}`), 'c');
    const yellows = num(
      await req().query(`SELECT COUNT(*) AS c FROM dbo.cards WHERE match_id = @match_id AND card_type IN ('yellow','second_yellow') ${teamFilter}`),
      'c',
    );
    const reds = num(await req().query(`SELECT COUNT(*) AS c FROM dbo.cards WHERE match_id = @match_id AND card_type = 'red' ${teamFilter}`), 'c');
    const passes = Number(
      (await req().query(`SELECT SUM(passes) AS s FROM dbo.match_player_stats WHERE match_id = @match_id ${teamFilter}`)).recordset[0]?.s ?? 0,
    );
    const recoveries = Number(
      (await req().query(`SELECT SUM(recoveries) AS s FROM dbo.match_player_stats WHERE match_id = @match_id ${teamFilter}`)).recordset[0]?.s ?? 0,
    );
    const interceptions = Number(
      (await req().query(`SELECT SUM(interceptions) AS s FROM dbo.match_player_stats WHERE match_id = @match_id ${teamFilter}`)).recordset[0]?.s ?? 0,
    );
    const possessions = num(
      await req().query(`SELECT COUNT(*) AS c FROM dbo.match_possessions WHERE match_id = @match_id ${teamFilter}`),
      'c',
    );
    const possessionsXg = Number(
      (await req().query(`SELECT SUM(xg) AS s FROM dbo.match_possessions WHERE match_id = @match_id ${teamFilter}`)).recordset[0]?.s ?? 0,
    );
    return {
      goles: goals,
      asistencias: assists,
      tiros: shotsOnly + goals,
      xg: Math.round(xg * 1000) / 1000,
      corners,
      faltas: fouls,
      amarillas: yellows,
      rojas: reds,
      pases: passes,
      recuperaciones: recoveries,
      intercepciones: interceptions,
      posesiones: possessions,
      posesiones_xg: Math.round(posesionesXg * 1000) / 1000,
    };
  }

  private assertValidJson(value: string, field: string) {
    try {
      JSON.parse(value);
    } catch {
      throw new BadRequestException(`El campo ${field} no es un JSON válido`);
    }
  }

  private async assertMatchExists(matchId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, matchId)
      .query('SELECT TOP 1 1 FROM dbo.matches WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Partido no encontrado');
  }

  private async assertTeamExists(teamId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, teamId)
      .query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('El equipo indicado no existe');
  }
}
