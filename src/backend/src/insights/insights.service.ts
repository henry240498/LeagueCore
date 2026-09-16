import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateTemplateDto, REPORT_SECTIONS, UpdateTemplateDto } from './dto/insights.dto';

// Grilla de densidad sobre coordenadas 0-100. Pura (testeable sin base).
export function buildGrid(
  points: { x: number; y: number; w?: number }[],
  cols = 8,
  rows = 12,
): { cols: number; rows: number; cells: { x: number; y: number; v: number }[]; max: number } {
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const p of points) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor((p.x / 100) * cols)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((p.y / 100) * rows)));
    grid[cy][cx] += p.w ?? 1;
  }
  let max = 0;
  const cells: { x: number; y: number; v: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] > 0) {
        max = Math.max(max, grid[y][x]);
        cells.push({ x, y, v: grid[y][x] });
      }
    }
  }
  return { cols, rows, cells, max };
}

export type ScoreState = 'GANANDO' | 'EMPATANDO' | 'PERDIENDO';

export function stateAtMinute(
  goals: { minute: number; teamId: number }[],
  teamId: number,
  minute: number,
): ScoreState {
  let mine = 0;
  let theirs = 0;
  for (const g of goals) {
    if ((g.minute ?? 0) <= minute) {
      if (g.teamId === teamId) mine += 1;
      else theirs += 1;
    }
  }
  if (mine > theirs) return 'GANANDO';
  if (mine < theirs) return 'PERDIENDO';
  return 'EMPATANDO';
}

@Injectable()
export class InsightsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // ---------- Mapas (punto 9) ----------
  async getMatchMaps(matchId: number, teamId?: number, playerId?: number) {
    const base = this.pool.request().input('match_id', sql.Int, matchId);
    if (teamId) base.input('team_id', sql.Int, teamId);
    if (playerId) base.input('player_id', sql.Int, playerId);
    const extra = `${teamId ? 'AND team_id = @team_id' : ''} ${playerId ? 'AND player_id = @player_id' : ''}`;
    const positions = await base.query(
      `SELECT pos_x, pos_y, weight FROM dbo.match_player_positions
       WHERE match_id = @match_id AND pos_x IS NOT NULL AND pos_y IS NOT NULL ${extra}`,
    );
    const heat = buildGrid(
      positions.recordset.map((r) => ({ x: Number(r.pos_x), y: Number(r.pos_y), w: Number(r.weight ?? 1) })),
    );
    const shots = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT pos_x, pos_y, outcome, xg FROM dbo.shots WHERE match_id = @match_id ${teamId ? 'AND team_id = ' + Number(teamId) : ''}`,
      );
    const goals = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT pos_x, pos_y FROM dbo.goals WHERE match_id = @match_id AND pos_x IS NOT NULL ${teamId ? 'AND team_id = ' + Number(teamId) : ''}`,
      );
    return {
      heat,
      positionSamples: positions.recordset.length,
      shots: shots.recordset.map((r) => ({ x: Number(r.pos_x), y: Number(r.pos_y), outcome: r.outcome, xg: r.xg === null ? null : Number(r.xg) })),
      goals: goals.recordset.map((r) => ({ x: Number(r.pos_x), y: Number(r.pos_y) })),
    };
  }

  // ---------- Estado del marcador (punto 23/24) ----------
  async getScoreState(matchId: number, teamId: number) {
    const goals = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query('SELECT team_id, minute, minute_extra FROM dbo.goals WHERE match_id = @match_id ORDER BY minute');
    const goalList = goals.recordset.map((g) => ({ teamId: g.team_id, minute: (g.minute ?? 0) + (g.minute_extra ?? 0) / 100 }));
    const shots = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, teamId)
      .query('SELECT minute, minute_extra, xg FROM dbo.shots WHERE match_id = @match_id AND team_id = @team_id');
    const agg: Record<ScoreState, { shots: number; xg: number; minutes: number }> = {
      GANANDO: { shots: 0, xg: 0, minutes: 0 },
      EMPATANDO: { shots: 0, xg: 0, minutes: 0 },
      PERDIENDO: { shots: 0, xg: 0, minutes: 0 },
    };
    // Minutos por estado (0-90 aproximado por segmentos entre goles)
    const bounds = [0, ...goalList.map((g) => Math.floor(g.minute)), 90];
    for (let i = 0; i < bounds.length - 1; i++) {
      const st = stateAtMinute(goalList.map((g) => ({ teamId: g.teamId, minute: g.minute })), teamId, bounds[i]);
      agg[st].minutes += bounds[i + 1] - bounds[i];
    }
    for (const s of shots.recordset) {
      const st = stateAtMinute(goalList.map((g) => ({ teamId: g.teamId, minute: g.minute })), teamId, s.minute ?? 0);
      agg[st].shots += 1;
      agg[st].xg = Math.round((agg[st].xg + Number(s.xg ?? 0)) * 1000) / 1000;
    }
    return agg;
  }

  async getTeamStateProfile(teamId: number) {
    const matches = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .query(
        `SELECT m.id FROM dbo.matches m
         WHERE m.status = 'finished' AND (m.home_team_id = @team_id OR m.away_team_id = @team_id)`,
      );
    const total: Record<ScoreState, { shots: number; xg: number }> = {
      GANANDO: { shots: 0, xg: 0 },
      EMPATANDO: { shots: 0, xg: 0 },
      PERDIENDO: { shots: 0, xg: 0 },
    };
    let matchesWithData = 0;
    for (const m of matches.recordset) {
      const agg = await this.getScoreState(m.id, teamId);
      if (agg.GANANDO.shots + agg.EMPATANDO.shots + agg.PERDIENDO.shots > 0) matchesWithData += 1;
      for (const st of ['GANANDO', 'EMPATANDO', 'PERDIENDO'] as ScoreState[]) {
        total[st].shots += agg[st].shots;
        total[st].xg = Math.round((total[st].xg + agg[st].xg) * 1000) / 1000;
      }
    }
    return { states: total, matchesAnalyzed: matches.recordset.length, matchesWithShots: matchesWithData };
  }

  // ---------- Plantillas de informe (punto 30) ----------
  async listTemplates(entity?: string) {
    const request = this.pool.request();
    const where = entity ? 'WHERE entity = @entity' : '';
    if (entity) request.input('entity', sql.NVarChar, entity);
    const result = await request.query(`SELECT * FROM dbo.report_templates ${where} ORDER BY name`);
    return result.recordset.map((r) => ({
      id: r.id,
      name: r.name,
      entity: r.entity,
      sections: JSON.parse(r.sections_json),
    }));
  }

  async createTemplate(dto: CreateTemplateDto) {
    this.assertSections(dto.entity, dto.sectionsJson);
    try {
      const result = await this.pool
        .request()
        .input('name', sql.NVarChar, dto.name)
        .input('entity', sql.NVarChar, dto.entity)
        .input('sections_json', sql.NVarChar, dto.sectionsJson)
        .query(
          'INSERT INTO dbo.report_templates (name, entity, sections_json) OUTPUT INSERTED.id VALUES (@name, @entity, @sections_json)',
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe una plantilla con ese nombre');
      }
      throw err;
    }
  }

  async updateTemplate(id: number, dto: UpdateTemplateDto) {
    const current = await this.getTemplate(id);
    if (dto.sectionsJson) this.assertSections(current.entity, dto.sectionsJson);
    const request = this.pool.request();
    const sets: string[] = [];
    if (dto.name !== undefined) {
      request.input('name', sql.NVarChar, dto.name);
      sets.push('name = @name');
    }
    if (dto.sectionsJson !== undefined) {
      request.input('sections_json', sql.NVarChar, dto.sectionsJson);
      sets.push('sections_json = @sections_json');
    }
    if (sets.length === 0) return current;
    sets.push('updated_at = SYSUTCDATETIME()');
    request.input('id', sql.Int, id);
    try {
      await request.query(`UPDATE dbo.report_templates SET ${sets.join(', ')} WHERE id = @id`);
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe una plantilla con ese nombre');
      }
      throw err;
    }
    return this.getTemplate(id);
  }

  async removeTemplate(id: number) {
    await this.getTemplate(id);
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.report_templates WHERE id = @id');
  }

  private async getTemplate(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.report_templates WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Plantilla no encontrada');
    const r = result.recordset[0];
    return { id: r.id, name: r.name, entity: r.entity, sections: JSON.parse(r.sections_json) };
  }

  private assertSections(entity: string, sectionsJson: string) {
    let sections: unknown;
    try {
      sections = JSON.parse(sectionsJson);
    } catch {
      throw new BadRequestException('sectionsJson no es un JSON válido');
    }
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new BadRequestException('La plantilla necesita al menos una sección');
    }
    const allowed = REPORT_SECTIONS[entity] ?? [];
    for (const s of sections) {
      if (!allowed.includes(s)) {
        throw new BadRequestException(`Sección inválida para ${entity}: ${s} (válidas: ${allowed.join(', ')})`);
      }
    }
  }

  // Genera el informe en Markdown componiendo secciones reales.
  async generate(templateId: number, opts: { matchId?: number; teamId?: number; playerId?: number }) {
    const template = await this.getTemplate(templateId);
    const lines: string[] = [`# ${template.name}`, ''];
    for (const section of template.sections as string[]) {
      lines.push(`## ${section.replace(/_/g, ' ')}`, '');
      lines.push(...(await this.buildSection(template.entity, section, opts)), '');
    }
    return { title: template.name, markdown: lines.join('\n') };
  }

  private async buildSection(entity: string, section: string, opts: { matchId?: number; teamId?: number; playerId?: number }): Promise<string[]> {
    const q = (t: string) => this.pool.request();
    void q;
    switch (`${entity}:${section}`) {
      case 'MATCH:RESULTADO':
      case 'MATCH:GOLES': {
        if (!opts.matchId) return ['_(Requiere matchId)_'];
        const goals = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query(
            `SELECT g.minute, p.full_name, t.name AS team_name FROM dbo.goals g
             JOIN dbo.players p ON p.id = g.player_id JOIN dbo.teams t ON t.id = g.team_id
             WHERE g.match_id = @match_id ORDER BY g.minute`,
          );
        const score = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query(`SELECT home_score, away_score FROM dbo.match_period_scores WHERE match_id = @match_id AND period = 'full_time'`);
        const s = score.recordset[0];
        return [
          s ? `Resultado: ${s.home_score} - ${s.away_score}` : 'Resultado sin cargar.',
          ...goals.recordset.map((g) => `• ${g.minute ?? '?'}′ ${g.full_name} (${g.team_name})`),
        ];
      }
      case 'MATCH:TIROS_XG':
      case 'MATCH:MAPA_TIROS': {
        if (!opts.matchId) return ['_(Requiere matchId)_'];
        const shots = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query(
            `SELECT t.name AS team_name, COUNT(*) AS c, SUM(s.xg) AS xg FROM dbo.shots s
             JOIN dbo.teams t ON t.id = s.team_id WHERE s.match_id = @match_id GROUP BY t.name`,
          );
        const goals = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query('SELECT COUNT(*) AS c FROM dbo.goals WHERE match_id = @match_id');
        return [
          ...shots.recordset.map((r) => `• ${r.team_name}: ${r.c} tiros, xG ${Number(r.xg ?? 0).toFixed(2)}`),
          `• Goles totales: ${goals.recordset[0]?.c ?? 0}`,
        ];
      }
      case 'MATCH:POSESIONES': {
        if (!opts.matchId) return ['_(Requiere matchId)_'];
        const poss = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query(
            `SELECT t.name AS team_name, COUNT(*) AS c, SUM(p.xg) AS xg FROM dbo.match_possessions p
             JOIN dbo.teams t ON t.id = p.team_id WHERE p.match_id = @match_id GROUP BY t.name`,
          );
        return poss.recordset.length
          ? poss.recordset.map((r) => `• ${r.team_name}: ${r.c} posesiones, xG ${Number(r.xg ?? 0).toFixed(2)}`)
          : ['Sin posesiones registradas.'];
      }
      case 'MATCH:BALON_PARADO': {
        if (!opts.matchId) return ['_(Requiere matchId)_'];
        const sp = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query(
            `SELECT kind, outcome, COUNT(*) AS c FROM dbo.match_set_pieces WHERE match_id = @match_id GROUP BY kind, outcome`,
          );
        return sp.recordset.length ? sp.recordset.map((r) => `• ${r.kind} → ${r.outcome ?? '—'}: ${r.c}`) : ['Sin balón parado registrado.'];
      }
      case 'MATCH:CAMBIOS': {
        if (!opts.matchId) return ['_(Requiere matchId)_'];
        const subs = await this.pool
          .request()
          .input('match_id', sql.Int, opts.matchId)
          .query(
            `SELECT s.minute, po.full_name AS out_name, pi.full_name AS in_name FROM dbo.substitutions s
             LEFT JOIN dbo.players po ON po.id = s.player_out_id LEFT JOIN dbo.players pi ON pi.id = s.player_in_id
             WHERE s.match_id = @match_id ORDER BY s.minute`,
          );
        return subs.recordset.length
          ? subs.recordset.map((r) => `• ${r.minute ?? '?'}′ ${r.out_name ?? '?'} → ${r.in_name ?? '?'}`)
          : ['Sin cambios registrados.'];
      }
      case 'MATCH:RESUMEN_IA':
        return ['Generado bajo demanda en /asistente (“Resumí el partido”).'];
      case 'TEAM:CONTEXTO': {
        if (!opts.teamId) return ['_(Requiere teamId)_'];
        const ctx = await this.teamContext(opts.teamId);
        return [`Local: ${ctx.home}`, `Visitante: ${ctx.away}`];
      }
      case 'TEAM:RACHA': {
        if (!opts.teamId) return ['_(Requiere teamId)_'];
        const prof = await this.getTeamStateProfile(opts.teamId);
        return [
          `Partidos analizados: ${prof.matchesAnalyzed} (con tiros: ${prof.matchesWithShots})`,
          `Ganando: ${prof.states.GANANDO.shots} tiros, xG ${prof.states.GANANDO.xg}`,
          `Empatando: ${prof.states.EMPATANDO.shots} tiros, xG ${prof.states.EMPATANDO.xg}`,
          `Perdiendo: ${prof.states.PERDIENDO.shots} tiros, xG ${prof.states.PERDIENDO.xg}`,
        ];
      }
      case 'TEAM:GOLEADORES':
      case 'PLAYER:GOLES': {
        const pid = opts.playerId;
        const tid = opts.teamId;
        const request = this.pool.request();
        let where = '';
        if (pid) {
          request.input('id', sql.Int, pid);
          where = 'AND g.player_id = @id';
        } else if (tid) {
          request.input('id', sql.Int, tid);
          where = 'AND g.team_id = @id';
        } else return ['_(Requiere teamId o playerId)_'];
        const goals = await request.query(
          `SELECT TOP 10 p.full_name, COUNT(*) AS g FROM dbo.goals g
           JOIN dbo.players p ON p.id = g.player_id WHERE 1 = 1 ${where} GROUP BY p.full_name ORDER BY g DESC`,
        );
        return goals.recordset.length
          ? goals.recordset.map((r, i) => `${i + 1}. ${r.full_name} — ${r.g}`)
          : ['Sin goles registrados.'];
      }
      case 'TEAM:DISCIPLINA': {
        const request = this.pool.request();
        const where = opts.teamId ? 'AND p.team_id = @id' : '';
        if (opts.teamId) request.input('id', sql.Int, opts.teamId);
        const rows = await request.query(
          `SELECT TOP 10 p.full_name,
             (SELECT COUNT(*) FROM dbo.cards c WHERE c.player_id = p.id AND c.card_type IN ('yellow','second_yellow')) AS y,
             (SELECT COUNT(*) FROM dbo.cards c WHERE c.player_id = p.id AND c.card_type = 'red') AS r
           FROM dbo.players p WHERE p.status = 'active' ${where} ORDER BY y DESC`,
        );
        return rows.recordset.map((r) => `• ${r.full_name}: ${r.y}🟨 ${r.r}🟥`);
      }
      case 'TEAM:OBJETIVOS':
      case 'PLAYER:OBJETIVOS': {
        const table = entity === 'TEAM' ? 'dbo.team_objectives' : 'dbo.player_objectives';
        const col = entity === 'TEAM' ? 'team_id' : 'player_id';
        const id = entity === 'TEAM' ? opts.teamId : opts.playerId;
        if (!id) return ['_(Requiere id)_'];
        const rows = await this.pool
          .request()
          .input('id', sql.Int, id)
          .query(`SELECT title, current_value, target_value, status FROM ${table} WHERE ${col} = @id`);
        return rows.recordset.length
          ? rows.recordset.map((r) => `• ${r.title}: ${r.current_value ?? 0}/${r.target_value ?? '?'} [${r.status}]`)
          : ['Sin objetivos.'];
      }
      case 'PLAYER:FICHA':
      case 'PLAYER:TECNICA':
      case 'PLAYER:FISICO':
      case 'PLAYER:LESIONES': {
        if (!opts.playerId) return ['_(Requiere playerId)_'];
        const p = await this.pool
          .request()
          .input('id', sql.Int, opts.playerId)
          .query('SELECT full_name, position, height_cm, weight_kg FROM dbo.players WHERE id = @id');
        const row = p.recordset[0];
        if (!row) return ['Jugador no encontrado.'];
        if (section === 'FICHA') return [`${row.full_name} — ${row.position ?? '?'} · ${row.height_cm ?? '?'} cm · ${row.weight_kg ?? '?'} kg`];
        if (section === 'TECNICA') {
          const t = await this.pool
            .request()
            .input('id', sql.Int, opts.playerId)
            .query(`SELECT TOP 5 attribute, value FROM dbo.player_technical_ratings WHERE player_id = @id ORDER BY value DESC`);
          return t.recordset.length ? t.recordset.map((r) => `• ${r.attribute}: ${r.value}`) : ['Sin valoraciones.'];
        }
        if (section === 'FISICO') {
          const f = await this.pool
            .request()
            .input('id', sql.Int, opts.playerId)
            .query('SELECT TOP 1 distance_m, max_speed_kmh, player_load FROM dbo.player_physical_records WHERE player_id = @id ORDER BY recorded_at DESC');
          const r0 = f.recordset[0];
          return r0 ? [`Distancia: ${r0.distance_m ?? '—'} m · Vel: ${r0.max_speed_kmh ?? '—'} km/h · Load: ${r0.player_load ?? '—'}`] : ['Sin registros físicos.'];
        }
        const inj = await this.pool
          .request()
          .input('id', sql.Int, opts.playerId)
          .query(`SELECT injury_type, status FROM dbo.player_injuries WHERE player_id = @id ORDER BY start_date DESC`);
        return inj.recordset.length ? inj.recordset.map((r) => `• ${r.injury_type} [${r.status}]`) : ['Sin lesiones.'];
      }
      default:
        return [`_(Sección ${section} no implementada)_`];
    }
  }

  private async teamContext(teamId: number): Promise<{ home: string; away: string }> {
    const req = () => this.pool.request().input('team_id', sql.Int, teamId);
    const home = await req().query(
      `SELECT COUNT(*) AS p, SUM(CASE WHEN ps.home_score > ps.away_score THEN 1 ELSE 0 END) AS w,
         SUM(ps.home_score) AS gf, SUM(ps.away_score) AS ga
       FROM dbo.matches m LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
       WHERE m.home_team_id = @team_id AND m.status = 'finished'`,
    );
    const away = await req().query(
      `SELECT COUNT(*) AS p, SUM(CASE WHEN ps.away_score > ps.home_score THEN 1 ELSE 0 END) AS w,
         SUM(ps.away_score) AS gf, SUM(ps.home_score) AS ga
       FROM dbo.matches m LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
       WHERE m.away_team_id = @team_id AND m.status = 'finished'`,
    );
    const h = home.recordset[0];
    const a = away.recordset[0];
    return {
      home: `${h.p} PJ, ${h.w ?? 0} G, ${h.gf ?? 0}:${h.ga ?? 0}`,
      away: `${a.p} PJ, ${a.w ?? 0} G, ${a.gf ?? 0}:${a.ga ?? 0}`,
    };
  }
}
