import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import {
  CreateRivalReportDto,
  CreateScoutingReportDto,
  CreateWatchItemDto,
  SaveRivalProfileDto,
  UpdateWatchItemDto,
} from './dto/scouting.dto';

export interface PlayerFilters {
  search?: string;
  position?: string;
  nationality?: string;
  foot?: string;
  teamId?: number;
  minAge?: number;
  maxAge?: number;
  minHeight?: number;
  minGoals?: number;
  minTechAvg?: number;
}

@Injectable()
export class ScoutingService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // ---------- Expediente del rival ----------
  async getRivalProfile(teamId: number) {
    await this.assertTeamExists(teamId);
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT * FROM dbo.rival_profiles WHERE team_id = @team_id');
    return result.recordset[0] ? toRivalCamel(result.recordset[0]) : null;
  }

  async saveRivalProfile(teamId: number, dto: SaveRivalProfileDto) {
    await this.assertTeamExists(teamId);
    const map: Record<string, string> = {
      usualFormation: 'usual_formation',
      strengths: 'strengths',
      weaknesses: 'weaknesses',
      buildup: 'buildup',
      pressing: 'pressing',
      transitions: 'transitions',
      setPieces: 'set_pieces',
      offensivePatterns: 'offensive_patterns',
      defensivePatterns: 'defensive_patterns',
      dangerousPlayers: 'dangerous_players',
      notes: 'notes',
    };
    const cols = ['team_id'];
    const vals = ['@team_id'];
    const sets: string[] = [];
    const request = this.pool.request().input('team_id', sql.Int, teamId);
    for (const [camel, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const column = map[camel];
      if (!column) continue;
      request.input(column, value);
      cols.push(column);
      vals.push(`@${column}`);
      sets.push(`${column} = @${column}`);
    }
    sets.push('updated_at = SYSUTCDATETIME()');
    await request.query(
      `MERGE dbo.rival_profiles AS t USING (SELECT @team_id AS team_id) AS s ON t.team_id = s.team_id
       WHEN MATCHED THEN UPDATE SET ${sets.join(', ')}
       WHEN NOT MATCHED THEN INSERT (${cols.join(', ')}) VALUES (${vals.join(', ')});`,
    );
    return this.getRivalProfile(teamId);
  }

  // Historial automático: últimos partidos + formaciones + goles + xG del rival.
  async getRivalHistory(teamId: number, limit = 10) {
    await this.assertTeamExists(teamId);
    const n = Math.min(Math.max(limit, 1), 30);
    const matches = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .input('limit_n', sql.Int, n)
      .query(
        `SELECT TOP (@limit_n) m.id, m.match_date, m.status, m.home_team_id, m.away_team_id,
           ht.name AS home_name, at.name AS away_name
         FROM dbo.matches m
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         WHERE (m.home_team_id = @team_id OR m.away_team_id = @team_id)
         ORDER BY m.match_date DESC, m.id DESC`,
      );
    const out = [];
    for (const m of matches.recordset) {
      const mine = m.home_team_id === teamId ? 'home' : 'away';
      const [formations, goals, xg] = await Promise.all([
        this.pool
          .request()
          .input('match_id', sql.Int, m.id)
          .input('team_id', sql.Int, teamId)
          .query(`SELECT formation_shape, period FROM dbo.match_formations WHERE match_id = @match_id AND team_id = @team_id`),
        this.pool
          .request()
          .input('match_id', sql.Int, m.id)
          .input('team_id', sql.Int, teamId)
          .query('SELECT COUNT(*) AS c FROM dbo.goals WHERE match_id = @match_id AND team_id = @team_id'),
        this.pool
          .request()
          .input('match_id', sql.Int, m.id)
          .input('team_id', sql.Int, teamId)
          .query('SELECT SUM(xg) AS s FROM dbo.shots WHERE match_id = @match_id AND team_id = @team_id'),
      ]);
      const fullTime = await this.pool
        .request()
        .input('match_id', sql.Int, m.id)
        .query(
          `SELECT home_score, away_score FROM dbo.match_period_scores WHERE match_id = @match_id AND period = 'full_time'`,
        );
      out.push({
        matchId: m.id,
        matchDate: m.match_date,
        status: m.status,
        homeName: m.home_name,
        awayName: m.away_name,
        weAre: mine,
        formations: formations.recordset.map((f) => ({ shape: f.formation_shape, period: f.period })),
        goals: Number(goals.recordset[0]?.c ?? 0),
        xg: Number(xg.recordset[0]?.s ?? 0),
        score: fullTime.recordset[0] ?? null,
      });
    }
    return out;
  }

  // ---------- Informes del rival ----------
  async listRivalReports(teamId: number) {
    await this.assertTeamExists(teamId);
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT * FROM dbo.rival_reports WHERE rival_team_id = @team_id ORDER BY created_at DESC');
    return result.recordset.map((r) => ({
      id: r.id,
      rivalTeamId: r.rival_team_id,
      title: r.title,
      content: r.content,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  }

  async createRivalReport(teamId: number, dto: CreateRivalReportDto) {
    await this.assertTeamExists(teamId);
    const result = await this.pool
      .request()
      .input('rival_team_id', sql.Int, teamId)
      .input('title', sql.NVarChar, dto.title)
      .input('content', sql.NVarChar, dto.content ?? null)
      .input('created_by', sql.NVarChar, dto.createdBy ?? null)
      .query(
        `INSERT INTO dbo.rival_reports (rival_team_id, title, content, created_by)
         OUTPUT INSERTED.id VALUES (@rival_team_id, @title, @content, @created_by)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeRivalReport(teamId: number, reportId: number) {
    await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .input('id', sql.Int, reportId)
      .query('DELETE FROM dbo.rival_reports WHERE id = @id AND rival_team_id = @team_id');
  }

  // ---------- Base de jugadores con filtros ----------
  async searchPlayers(f: PlayerFilters) {
    const request = this.pool.request();
    const conditions: string[] = [`p.status = 'active'`];
    if (f.search) {
      request.input('search', sql.NVarChar, `%${f.search}%`);
      conditions.push('p.full_name LIKE @search');
    }
    if (f.position) {
      request.input('position', sql.NVarChar, f.position);
      conditions.push('p.position = @position');
    }
    if (f.nationality) {
      request.input('nationality', sql.NVarChar, f.nationality);
      conditions.push('p.nationality = @nationality');
    }
    if (f.foot) {
      request.input('foot', sql.NVarChar, f.foot);
      conditions.push('p.preferred_foot = @foot');
    }
    if (f.teamId) {
      request.input('team_id', sql.Int, f.teamId);
      conditions.push('p.team_id = @team_id');
    }
    if (f.minAge !== undefined) {
      request.input('min_age', sql.Int, f.minAge);
      conditions.push('(p.date_of_birth IS NOT NULL AND DATEDIFF(year, p.date_of_birth, GETDATE()) >= @min_age)');
    }
    if (f.maxAge !== undefined) {
      request.input('max_age', sql.Int, f.maxAge);
      conditions.push('(p.date_of_birth IS NOT NULL AND DATEDIFF(year, p.date_of_birth, GETDATE()) <= @max_age)');
    }
    if (f.minHeight !== undefined) {
      request.input('min_height', sql.Int, f.minHeight);
      conditions.push('(p.height_cm IS NOT NULL AND p.height_cm >= @min_height)');
    }
    if (f.minGoals !== undefined) {
      request.input('min_goals', sql.Int, f.minGoals);
      conditions.push('(SELECT COUNT(*) FROM dbo.goals g WHERE g.player_id = p.id) >= @min_goals');
    }
    if (f.minTechAvg !== undefined) {
      request.input('min_tech', sql.Int, f.minTechAvg);
      conditions.push('(SELECT AVG(CAST(value AS FLOAT)) FROM dbo.player_technical_ratings r WHERE r.player_id = p.id) >= @min_tech');
    }
    const result = await request.query(
      `SELECT TOP 100 p.id, p.full_name, p.position, p.nationality, p.date_of_birth, p.height_cm,
         p.preferred_foot, p.team_id, t.name AS team_name,
         DATEDIFF(year, p.date_of_birth, GETDATE()) AS age,
         (SELECT COUNT(*) FROM dbo.goals g WHERE g.player_id = p.id) AS goals,
         (SELECT COUNT(*) FROM dbo.goals g WHERE g.assist_player_id = p.id) AS assists,
         (SELECT AVG(CAST(value AS FLOAT)) FROM dbo.player_technical_ratings r WHERE r.player_id = p.id) AS tech_avg
       FROM dbo.players p LEFT JOIN dbo.teams t ON t.id = p.team_id
       WHERE ${conditions.join(' AND ')} ORDER BY p.full_name`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      position: r.position,
      nationality: r.nationality,
      age: r.age,
      heightCm: r.height_cm,
      preferredFoot: r.preferred_foot,
      teamId: r.team_id,
      teamName: r.team_name,
      goals: r.goals,
      assists: r.assists,
      techAvg: r.tech_avg === null ? null : Math.round(Number(r.tech_avg) * 10) / 10,
    }));
  }

  // Comparador A vs B con datos reales (radar técnico + físico + resumen).
  async comparePlayers(ids: number[]) {
    if (ids.length < 2 || ids.length > 4) {
      throw new BadRequestException('Compará entre 2 y 4 jugadores');
    }
    const out = [];
    for (const id of ids) {
      const player = await this.pool
        .request()
        .input('id', sql.Int, id)
        .query(
          `SELECT p.*, t.name AS team_name,
            DATEDIFF(year, p.date_of_birth, GETDATE()) AS age,
            (SELECT COUNT(*) FROM dbo.goals g WHERE g.player_id = p.id) AS goals,
            (SELECT COUNT(*) FROM dbo.goals g WHERE g.assist_player_id = p.id) AS assists,
            (SELECT COUNT(DISTINCT match_id) FROM dbo.match_lineups WHERE player_id = p.id) AS matches
           FROM dbo.players p LEFT JOIN dbo.teams t ON t.id = p.team_id WHERE p.id = @id`,
        );
      if (player.recordset.length === 0) throw new NotFoundException(`Jugador ${id} no encontrado`);
      const r = player.recordset[0];
      const technical = await this.pool
        .request()
        .input('player_id', sql.Int, id)
        .query(
          `SELECT r.attribute, r.value FROM dbo.player_technical_ratings r
           JOIN (SELECT attribute, MAX(evaluated_at) AS max_date FROM dbo.player_technical_ratings
                 WHERE player_id = @player_id GROUP BY attribute) m
             ON m.attribute = r.attribute AND m.max_date = r.evaluated_at WHERE r.player_id = @player_id`,
        );
      const physical = await this.pool
        .request()
        .input('player_id', sql.Int, id)
        .query('SELECT TOP 1 * FROM dbo.player_physical_records WHERE player_id = @player_id ORDER BY recorded_at DESC');
      out.push({
        id: r.id,
        fullName: r.full_name,
        position: r.position,
        age: r.age,
        heightCm: r.height_cm,
        weightKg: r.weight_kg,
        teamName: r.team_name,
        matches: r.matches,
        goals: r.goals,
        assists: r.assists,
        technical: technical.recordset.map((t) => ({ attribute: t.attribute, value: t.value })),
        physicalLatest: physical.recordset[0]
          ? {
              maxSpeedKmh: physical.recordset[0].max_speed_kmh,
              distanceM: physical.recordset[0].distance_m,
              sprints: physical.recordset[0].sprints,
              playerLoad: physical.recordset[0].player_load,
            }
          : null,
      });
    }
    return out;
  }

  // ---------- Informes de scouting ----------
  async listScoutingReports(playerId?: number) {
    const request = this.pool.request();
    const where = playerId ? 'WHERE s.player_id = @player_id' : '';
    if (playerId) request.input('player_id', sql.Int, playerId);
    const result = await request.query(
      `SELECT s.*, p.full_name AS player_name FROM dbo.scouting_reports s
       LEFT JOIN dbo.players p ON p.id = s.player_id ${where} ORDER BY s.created_at DESC`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      playerName: r.player_name,
      externalName: r.external_name,
      position: r.position,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
      recommendation: r.recommendation,
      rating: r.rating,
      scoutName: r.scout_name,
      reportDate: r.report_date,
      createdAt: r.created_at,
    }));
  }

  async createScoutingReport(dto: CreateScoutingReportDto) {
    if (!dto.playerId && !dto.externalName) {
      throw new BadRequestException('Indicá un jugador registrado o un nombre externo');
    }
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, dto.playerId ?? null)
      .input('external_name', sql.NVarChar, dto.externalName ?? null)
      .input('position', sql.NVarChar, dto.position ?? null)
      .input('strengths', sql.NVarChar, dto.strengths ?? null)
      .input('weaknesses', sql.NVarChar, dto.weaknesses ?? null)
      .input('recommendation', sql.NVarChar, dto.recommendation ?? null)
      .input('rating', sql.SmallInt, dto.rating ?? null)
      .input('scout_name', sql.NVarChar, dto.scoutName ?? null)
      .input('report_date', sql.Date, dto.reportDate ?? null)
      .query(
        `INSERT INTO dbo.scouting_reports
          (player_id, external_name, position, strengths, weaknesses, recommendation, rating, scout_name, report_date)
         OUTPUT INSERTED.id
         VALUES (@player_id, @external_name, @position, @strengths, @weaknesses, @recommendation, @rating, @scout_name, @report_date)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeScoutingReport(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.scouting_reports WHERE id = @id');
  }

  // ---------- Watchlist ----------
  async listWatchlist(status?: string) {
    const request = this.pool.request();
    const where = status ? 'WHERE w.status = @status' : '';
    if (status) request.input('status', sql.NVarChar, status);
    const result = await request.query(
      `SELECT w.*, p.full_name AS player_name FROM dbo.watchlist w
       LEFT JOIN dbo.players p ON p.id = w.player_id ${where}
       ORDER BY CASE w.priority WHEN 'ALTA' THEN 0 WHEN 'MEDIA' THEN 1 ELSE 2 END, w.next_observation`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      playerName: r.player_name,
      externalName: r.external_name,
      priority: r.priority,
      status: r.status,
      owner: r.owner,
      lastObservation: r.last_observation,
      nextObservation: r.next_observation,
      notes: r.notes,
    }));
  }

  async addWatchItem(dto: CreateWatchItemDto) {
    if (!dto.playerId && !dto.externalName) {
      throw new BadRequestException('Indicá un jugador registrado o un nombre externo');
    }
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, dto.playerId ?? null)
      .input('external_name', sql.NVarChar, dto.externalName ?? null)
      .input('priority', sql.NVarChar, dto.priority ?? 'MEDIA')
      .input('status', sql.NVarChar, dto.status ?? 'OBSERVADO')
      .input('owner', sql.NVarChar, dto.owner ?? null)
      .input('last_observation', sql.Date, dto.lastObservation ?? null)
      .input('next_observation', sql.Date, dto.nextObservation ?? null)
      .input('notes', sql.NVarChar, dto.notes ?? null)
      .query(
        `INSERT INTO dbo.watchlist
          (player_id, external_name, priority, status, owner, last_observation, next_observation, notes)
         OUTPUT INSERTED.id
         VALUES (@player_id, @external_name, @priority, @status, @owner, @last_observation, @next_observation, @notes)`,
      );
    return { id: result.recordset[0].id };
  }

  async updateWatchItem(id: number, dto: UpdateWatchItemDto) {
    const map: Record<string, string> = {
      priority: 'priority',
      status: 'status',
      owner: 'owner',
      lastObservation: 'last_observation',
      nextObservation: 'next_observation',
      notes: 'notes',
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
      await request.query(`UPDATE dbo.watchlist SET ${sets.join(', ')} WHERE id = @id`);
    }
    return { id };
  }

  async removeWatchItem(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.watchlist WHERE id = @id');
  }

  private async assertTeamExists(teamId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, teamId)
      .query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Equipo no encontrado');
  }
}

function toRivalCamel(r: Record<string, any>) {
  return {
    teamId: r.team_id,
    usualFormation: r.usual_formation,
    strengths: r.strengths,
    weaknesses: r.weaknesses,
    buildup: r.buildup,
    pressing: r.pressing,
    transitions: r.transitions,
    setPieces: r.set_pieces,
    offensivePatterns: r.offensive_patterns,
    defensivePatterns: r.defensive_patterns,
    dangerousPlayers: r.dangerous_players,
    notes: r.notes,
    updatedAt: r.updated_at,
  };
}
