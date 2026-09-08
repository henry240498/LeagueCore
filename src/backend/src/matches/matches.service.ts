import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import type { RequestMeta } from '../auth/auth.service';
import { ParametersService } from '../parameters/parameters.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { SetPeriodScoreDto } from './dto/set-period-score.dto';

const COLUMN_MAP: Record<string, string> = {
  competitionId: 'competition_id',
  seasonId: 'season_id',
  homeTeamId: 'home_team_id',
  awayTeamId: 'away_team_id',
  venueId: 'venue_id',
  matchDate: 'match_date',
  matchTime: 'match_time',
  status: 'status',
  attendance: 'attendance',
  round: 'round',
  phase: 'phase',
  groupName: 'group_name',
  leg: 'leg',
  weatherCondition: 'weather_condition',
  temperatureCelsius: 'temperature_celsius',
  humidityPct: 'humidity_pct',
  windKmh: 'wind_kmh',
  pitchCondition: 'pitch_condition',
  comments: 'comments',
};

const COLUMN_TYPES: Record<string, (() => sql.ISqlType) | sql.ISqlType> = {
  competition_id: sql.Int,
  season_id: sql.Int,
  home_team_id: sql.Int,
  away_team_id: sql.Int,
  venue_id: sql.Int,
  match_date: sql.Date,
  match_time: sql.NVarChar,
  status: sql.NVarChar,
  attendance: sql.Int,
  round: sql.NVarChar,
  phase: sql.NVarChar,
  group_name: sql.NVarChar,
  leg: sql.NVarChar,
  weather_condition: sql.NVarChar,
  temperature_celsius: sql.Decimal(4, 1),
  humidity_pct: sql.Decimal(4, 1),
  wind_kmh: sql.Decimal(5, 1),
  pitch_condition: sql.NVarChar,
  comments: sql.NVarChar,
};

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    televised: !!row.televised,
    dataOrigin: row.data_origin,
    externalSource: row.external_source,
    externalId: row.external_id,
    externalUrl: row.external_url,
    lastSyncedAt: row.last_synced_at,
  };
  for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
    out[camel] = row[snake];
  }
  if (row.competition_name !== undefined) out.competitionName = row.competition_name;
  if (row.season_label !== undefined) out.seasonLabel = row.season_label;
  if (row.home_team_name !== undefined) out.homeTeamName = row.home_team_name;
  if (row.away_team_name !== undefined) out.awayTeamName = row.away_team_name;
  if (row.home_team_logo_url !== undefined) out.homeTeamLogoUrl = row.home_team_logo_url;
  if (row.away_team_logo_url !== undefined) out.awayTeamLogoUrl = row.away_team_logo_url;
  if (row.venue_name !== undefined) out.venueName = row.venue_name;
  if (row.venue_photo_url !== undefined) out.venuePhotoUrl = row.venue_photo_url;
  return out;
}

export interface ListQuery {
  search?: string;
  competitionId?: number;
  seasonId?: number;
  teamId?: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  matchDate: 'm.match_date',
  status: 'm.status',
  competitionName: 'c.name',
  createdAt: 'm.created_at',
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const BASE_SELECT = `
  SELECT m.*, c.name AS competition_name, s.label AS season_label,
         ht.name AS home_team_name, at.name AS away_team_name,
         ht.logo_url AS home_team_logo_url, at.logo_url AS away_team_logo_url,
         v.name AS venue_name, v.photo_url AS venue_photo_url
  FROM dbo.matches m
  JOIN dbo.competitions c ON c.id = m.competition_id
  JOIN dbo.seasons s ON s.id = m.season_id
  JOIN dbo.teams ht ON ht.id = m.home_team_id
  JOIN dbo.teams at ON at.id = m.away_team_id
  LEFT JOIN dbo.venues v ON v.id = m.venue_id
`;

@Injectable()
export class MatchesService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly parameters: ParametersService,
  ) {}

  async list(query: ListQuery) {
    const request = this.pool.request();
    const conditions: string[] = [];

    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('(c.name LIKE @search OR ht.name LIKE @search OR at.name LIKE @search)');
    }
    if (query.competitionId) {
      request.input('competition_id', sql.Int, query.competitionId);
      conditions.push('m.competition_id = @competition_id');
    }
    if (query.seasonId) {
      request.input('season_id', sql.Int, query.seasonId);
      conditions.push('m.season_id = @season_id');
    }
    if (query.teamId) {
      request.input('team_id', sql.Int, query.teamId);
      conditions.push('(m.home_team_id = @team_id OR m.away_team_id = @team_id)');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('m.status = @status');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const hasExplicitSort = !!query.sortBy && !!SORTABLE_COLUMNS[query.sortBy];
    const sortColumn = hasExplicitSort ? SORTABLE_COLUMNS[query.sortBy as string] : 'm.match_date';
    // Sin orden explícito, partidos más recientes primero (mismo criterio que Temporadas).
    const sortDir = hasExplicitSort ? (query.sortDir === 'desc' ? 'DESC' : 'ASC') : 'DESC';

    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const offset = (page - 1) * pageSize;
    request.input('offset', sql.Int, offset);
    request.input('page_size', sql.Int, pageSize);

    const result = await request.query(
      `SELECT m.*, c.name AS competition_name, s.label AS season_label,
              ht.name AS home_team_name, at.name AS away_team_name, v.name AS venue_name,
              COUNT(*) OVER() AS total_count
       FROM dbo.matches m
       JOIN dbo.competitions c ON c.id = m.competition_id
       JOIN dbo.seasons s ON s.id = m.season_id
       JOIN dbo.teams ht ON ht.id = m.home_team_id
       JOIN dbo.teams at ON at.id = m.away_team_id
       LEFT JOIN dbo.venues v ON v.id = m.venue_id
       ${where}
       ORDER BY ${sortColumn} ${sortDir}, m.id DESC
       OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
    );

    // Resultado (full_time) para el listado — una sola consulta extra, liviana.
    const ids = result.recordset.map((r) => r.id);
    const scores = ids.length ? await this.getFullTimeScores(ids) : new Map();

    return {
      items: result.recordset.map((r) => ({ ...toCamel(r), score: scores.get(r.id) ?? null })),
      total: result.recordset[0]?.total_count ?? 0,
      page,
      pageSize,
    };
  }

  private async getFullTimeScores(matchIds: number[]) {
    const result = await this.pool
      .request()
      .query(
        `SELECT match_id, home_score, away_score FROM dbo.match_period_scores
         WHERE period = 'full_time' AND match_id IN (${matchIds.join(',')})`,
      );
    const map = new Map<number, { homeScore: number; awayScore: number }>();
    for (const row of result.recordset) {
      map.set(row.match_id, { homeScore: row.home_score, awayScore: row.away_score });
    }
    return map;
  }

  async checkDuplicates(competitionId: number, homeTeamId: number, awayTeamId: number, matchDate: string) {
    const result = await this.pool
      .request()
      .input('competition_id', sql.Int, competitionId)
      .input('home_team_id', sql.Int, homeTeamId)
      .input('away_team_id', sql.Int, awayTeamId)
      .input('match_date', sql.Date, matchDate)
      .query(
        `SELECT m.id, m.match_date, m.round, m.phase, ht.name AS home_team_name, at.name AS away_team_name
         FROM dbo.matches m
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         WHERE m.competition_id = @competition_id AND m.match_date = @match_date
           AND ((m.home_team_id = @home_team_id AND m.away_team_id = @away_team_id)
             OR (m.home_team_id = @away_team_id AND m.away_team_id = @home_team_id))`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      matchDate: r.match_date,
      round: r.round,
      phase: r.phase,
      homeTeamName: r.home_team_name,
      awayTeamName: r.away_team_name,
    }));
  }

  async getById(id: number) {
    const result = await this.pool.request().input('id', sql.Int, id).query(`${BASE_SELECT} WHERE m.id = @id`);
    if (result.recordset.length === 0) throw new NotFoundException('Partido no encontrado');
    const match = toCamel(result.recordset[0]);

    const periodScores = await this.pool
      .request()
      .input('match_id', sql.Int, id)
      .query('SELECT period, home_score, away_score FROM dbo.match_period_scores WHERE match_id = @match_id');
    match.periodScores = periodScores.recordset.map((r) => ({
      period: r.period,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));

    return match;
  }

  async create(dto: CreateMatchDto, meta: RequestMeta, userId: number | null) {
    if (dto.status !== undefined) {
      await this.parameters.assertActiveCode('match_status', dto.status, 'Estado del partido');
    }
    await this.assertCompetitionExists(dto.competitionId);
    await this.assertSeasonBelongsToCompetition(dto.seasonId, dto.competitionId);
    if (dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException('El equipo local y el visitante no pueden ser el mismo');
    }
    await this.assertTeamBelongsToCompetition(dto.homeTeamId, dto.seasonId);
    await this.assertTeamBelongsToCompetition(dto.awayTeamId, dto.seasonId);
    if (dto.venueId) await this.assertVenueExists(dto.venueId);

    const request = this.pool.request();
    const columns: string[] = [];
    const params: string[] = [];
    for (const [camel, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const column = COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, COLUMN_TYPES[column], value);
      columns.push(column);
      params.push(`@${column}`);
    }

    const result = await request.query(
      `INSERT INTO dbo.matches (${columns.join(', ')})
       OUTPUT INSERTED.id
       VALUES (${params.join(', ')})`,
    );
    const id = result.recordset[0].id;
    await this.audit(userId, 'create_match', id, meta, `${dto.homeTeamId} vs ${dto.awayTeamId}`);
    return this.getById(id);
  }

  async update(id: number, dto: UpdateMatchDto, meta: RequestMeta, userId: number | null) {
    if (dto.status !== undefined) {
      await this.parameters.assertActiveCode('match_status', dto.status, 'Estado del partido');
    }
    const current = await this.getById(id);
    const competitionId = dto.competitionId ?? current.competitionId;
    const seasonId = dto.seasonId ?? current.seasonId;
    if (dto.seasonId) await this.assertSeasonBelongsToCompetition(dto.seasonId, competitionId);
    const homeTeamId = dto.homeTeamId ?? current.homeTeamId;
    const awayTeamId = dto.awayTeamId ?? current.awayTeamId;
    if (homeTeamId === awayTeamId) {
      throw new BadRequestException('El equipo local y el visitante no pueden ser el mismo');
    }
    if (dto.homeTeamId) await this.assertTeamBelongsToCompetition(dto.homeTeamId, seasonId);
    if (dto.awayTeamId) await this.assertTeamBelongsToCompetition(dto.awayTeamId, seasonId);
    if (dto.venueId) await this.assertVenueExists(dto.venueId);

    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      const request = this.pool.request();
      const setClauses: string[] = [];
      for (const [camel, value] of entries) {
        const column = COLUMN_MAP[camel];
        if (!column) continue;
        request.input(column, COLUMN_TYPES[column], value);
        setClauses.push(`${column} = @${column}`);
      }
      setClauses.push('updated_at = SYSUTCDATETIME()');
      request.input('id', sql.Int, id);
      await request.query(`UPDATE dbo.matches SET ${setClauses.join(', ')} WHERE id = @id`);
    }

    const changedKeys = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
    await this.audit(userId, 'update_match', id, meta, changedKeys.join(', '));
    return this.getById(id);
  }

  async setStatus(id: number, status: string, meta: RequestMeta, userId: number | null) {
    await this.parameters.assertActiveCode('match_status', status, 'Estado del partido');
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE dbo.matches SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    await this.audit(userId, 'change_match_status', id, meta, `status: ${status}`);
    return this.getById(id);
  }

  async remove(id: number, meta: RequestMeta, userId: number | null) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.matches WHERE id = @id');
      await this.audit(userId, 'delete_match', id, meta);
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el partido tiene eventos, estadísticas u otros datos asociados. Cancelalo en su lugar.',
        );
      }
      throw err;
    }
  }

  async setPeriodScore(matchId: number, dto: SetPeriodScoreDto, meta: RequestMeta, userId: number | null) {
    await this.getById(matchId);
    const request = this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('period', sql.NVarChar, dto.period)
      .input('home_score', sql.SmallInt, dto.homeScore)
      .input('away_score', sql.SmallInt, dto.awayScore);
    await request.query(
      `MERGE dbo.match_period_scores AS target
       USING (SELECT @match_id AS match_id, @period AS period) AS src
       ON target.match_id = src.match_id AND target.period = src.period
       WHEN MATCHED THEN UPDATE SET home_score = @home_score, away_score = @away_score
       WHEN NOT MATCHED THEN INSERT (match_id, period, home_score, away_score)
         VALUES (@match_id, @period, @home_score, @away_score);`,
    );
    await this.audit(userId, 'set_match_result', matchId, meta, `${dto.period}: ${dto.homeScore}-${dto.awayScore}`);
    return this.getById(matchId);
  }

  async removePeriodScore(matchId: number, period: string, meta: RequestMeta, userId: number | null) {
    await this.getById(matchId);
    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('period', sql.NVarChar, period)
      .query('DELETE FROM dbo.match_period_scores WHERE match_id = @match_id AND period = @period');
    await this.audit(userId, 'remove_match_result', matchId, meta, period);
    return this.getById(matchId);
  }

  async getHistory(matchId: number) {
    const result = await this.pool
      .request()
      .input('entity_id', sql.Int, matchId)
      .query(
        `SELECT al.action, al.details, al.created_at, u.username
         FROM dbo.audit_log al
         LEFT JOIN dbo.users u ON u.id = al.user_id
         WHERE al.entity = 'match' AND al.entity_id = @entity_id
         ORDER BY al.created_at DESC`,
      );
    return result.recordset.map((r) => ({
      action: r.action,
      details: r.details,
      createdAt: r.created_at,
      username: r.username,
    }));
  }

  async assertCompetitionExists(competitionId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, competitionId)
      .query('SELECT TOP 1 1 FROM dbo.competitions WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('La competición indicada no existe');
  }

  async assertSeasonBelongsToCompetition(seasonId: number, competitionId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, seasonId)
      .query('SELECT competition_id FROM dbo.seasons WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('La temporada indicada no existe');
    if (result.recordset[0].competition_id !== competitionId) {
      throw new BadRequestException('La temporada indicada no pertenece a la competición seleccionada');
    }
  }

  // Un club es una entidad independiente (§9/§21 del pedido de corrección arquitectónica) -- ya no
  // se rechaza un partido porque el equipo "no pertenece" a la competición (esa restricción fija ya
  // no existe). En cambio, se REGISTRA la participación real: si el equipo todavía no está
  // vinculado a esta temporada en season_teams, se agrega automáticamente -- el partido en sí mismo
  // es evidencia real de que el equipo jugó ahí, no una suposición.
  async assertTeamBelongsToCompetition(teamId: number, seasonId: number) {
    const teamResult = await this.pool.request().input('id', sql.Int, teamId).query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (teamResult.recordset.length === 0) throw new BadRequestException('El equipo indicado no existe');

    const existing = await this.pool
      .request()
      .input('season_id', sql.Int, seasonId)
      .input('team_id', sql.Int, teamId)
      .query('SELECT 1 FROM dbo.season_teams WHERE season_id = @season_id AND team_id = @team_id');
    if (existing.recordset.length === 0) {
      await this.pool
        .request()
        .input('season_id', sql.Int, seasonId)
        .input('team_id', sql.Int, teamId)
        .query('INSERT INTO dbo.season_teams (season_id, team_id) VALUES (@season_id, @team_id)');
    }
  }

  private async assertVenueExists(venueId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, venueId)
      .query('SELECT TOP 1 1 FROM dbo.venues WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('El estadio indicado no existe');
  }

  async audit(userId: number | null, action: string, matchId: number, meta: RequestMeta, details?: string) {
    await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .input('action', sql.NVarChar, action)
      .input('entity', sql.NVarChar, 'match')
      .input('entity_id', sql.Int, matchId)
      .input('details', sql.NVarChar, details ?? null)
      .input('ip_address', sql.NVarChar, meta.ip ?? null)
      .query(
        `INSERT INTO dbo.audit_log (user_id, action, entity, entity_id, details, ip_address)
         VALUES (@user_id, @action, @entity, @entity_id, @details, @ip_address)`,
      );
  }
}
