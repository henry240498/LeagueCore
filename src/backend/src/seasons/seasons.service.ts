import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

// is_current queda deliberadamente fuera de este mapa: se gestiona sólo por setCurrent(), que
// mantiene la invariante "una sola temporada actual por competición" limpiando las demás antes de
// marcar la nueva — si is_current se pudiera pisar por un PUT genérico, esa invariante se podría
// romper (o chocar contra el índice único filtrado que la protege en la base).
const COLUMN_MAP: Record<string, string> = {
  competitionId: 'competition_id',
  startYear: 'start_year',
  endYear: 'end_year',
  startDate: 'start_date',
  endDate: 'end_date',
  status: 'status',
  observations: 'observations',
  dataCompleteness: 'data_completeness',
};

const COLUMN_TYPES: Record<string, (() => sql.ISqlType) | sql.ISqlType> = {
  competition_id: sql.Int,
  start_year: sql.SmallInt,
  end_year: sql.SmallInt,
  start_date: sql.Date,
  end_date: sql.Date,
  status: sql.NVarChar,
  observations: sql.NVarChar,
  data_completeness: sql.NVarChar,
};

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    label: row.label,
    isCurrent: !!row.is_current,
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
  return out;
}

export interface ListQuery {
  search?: string;
  competitionId?: number;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  label: 's.start_year',
  startYear: 's.start_year',
  competitionName: 'c.name',
  status: 's.status',
  startDate: 's.start_date',
  createdAt: 's.created_at',
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class SeasonsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(query: ListQuery) {
    const request = this.pool.request();
    const conditions: string[] = [];

    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('(s.label LIKE @search OR c.name LIKE @search)');
    }
    if (query.competitionId) {
      request.input('competition_id', sql.Int, query.competitionId);
      conditions.push('s.competition_id = @competition_id');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('s.status = @status');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const hasExplicitSort = !!query.sortBy && !!SORTABLE_COLUMNS[query.sortBy];
    const sortColumn = hasExplicitSort ? SORTABLE_COLUMNS[query.sortBy as string] : 's.start_year';
    // Sin sortBy explícito, mostrar las temporadas más nuevas primero (más útil que orden
    // alfabético para una entidad pensada para acumular historial); con sortBy explícito, misma
    // convención que el resto de los módulos (ASC salvo que se pida 'desc').
    const sortDir = hasExplicitSort ? (query.sortDir === 'desc' ? 'DESC' : 'ASC') : 'DESC';

    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const offset = (page - 1) * pageSize;
    request.input('offset', sql.Int, offset);
    request.input('page_size', sql.Int, pageSize);

    const result = await request.query(
      `SELECT s.*, c.name AS competition_name, COUNT(*) OVER() AS total_count
       FROM dbo.seasons s
       JOIN dbo.competitions c ON c.id = s.competition_id
       ${where}
       ORDER BY ${sortColumn} ${sortDir}, c.name ASC
       OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
    );

    return {
      items: result.recordset.map(toCamel),
      total: result.recordset[0]?.total_count ?? 0,
      page,
      pageSize,
    };
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT s.*, c.name AS competition_name
         FROM dbo.seasons s
         JOIN dbo.competitions c ON c.id = s.competition_id
         WHERE s.id = @id`,
      );
    if (result.recordset.length === 0) {
      throw new NotFoundException('Temporada no encontrada');
    }
    const season = toCamel(result.recordset[0]);

    const teams = await this.pool
      .request()
      .input('season_id', sql.Int, id)
      .query(
        `SELECT t.id, t.name, t.status
         FROM dbo.season_teams st
         JOIN dbo.teams t ON t.id = st.team_id
         WHERE st.season_id = @season_id
         ORDER BY t.name`,
      );
    season.teams = teams.recordset.map((r) => ({ id: r.id, name: r.name, status: r.status }));

    return season;
  }

  async create(dto: CreateSeasonDto) {
    await this.assertCompetitionExists(dto.competitionId);
    const endYear = dto.endYear ?? dto.startYear;
    if (endYear < dto.startYear) {
      throw new BadRequestException('El año de fin no puede ser anterior al año de inicio');
    }
    this.assertValidDateRange(dto.startDate, dto.endDate);

    const request = this.pool.request();
    const columns: string[] = [];
    const params: string[] = [];
    const values: Record<string, any> = { ...dto, endYear };
    for (const [camel, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const column = COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, COLUMN_TYPES[column], value);
      columns.push(column);
      params.push(`@${column}`);
    }

    try {
      const result = await request.query(
        `INSERT INTO dbo.seasons (${columns.join(', ')})
         OUTPUT INSERTED.id
         VALUES (${params.join(', ')})`,
      );
      return this.getById(result.recordset[0].id);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ya existe una temporada con ese período en esta competición');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateSeasonDto) {
    const current = await this.getById(id);
    if (dto.competitionId) await this.assertCompetitionExists(dto.competitionId);

    const startYear = dto.startYear ?? current.startYear;
    const endYear = dto.endYear ?? current.endYear;
    if (endYear < startYear) {
      throw new BadRequestException('El año de fin no puede ser anterior al año de inicio');
    }
    this.assertValidDateRange(
      dto.startDate !== undefined ? dto.startDate : current.startDate,
      dto.endDate !== undefined ? dto.endDate : current.endDate,
    );

    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return current;

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

    try {
      await request.query(`UPDATE dbo.seasons SET ${setClauses.join(', ')} WHERE id = @id`);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ya existe una temporada con ese período en esta competición');
      }
      throw err;
    }

    return this.getById(id);
  }

  async setStatus(id: number, status: 'active' | 'inactive') {
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE dbo.seasons SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    return this.getById(id);
  }

  async setCurrent(id: number, isCurrent: boolean) {
    const season = await this.getById(id);
    if (isCurrent) {
      // Limpia cualquier otra temporada "actual" de la misma competición antes de marcar ésta —
      // si se hiciera al revés, violaría el índice único filtrado que garantiza una sola actual.
      await this.pool
        .request()
        .input('competition_id', sql.Int, season.competitionId)
        .input('id', sql.Int, id)
        .query(
          `UPDATE dbo.seasons SET is_current = 0, updated_at = SYSUTCDATETIME()
           WHERE competition_id = @competition_id AND id <> @id AND is_current = 1`,
        );
    }
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('is_current', sql.Bit, isCurrent)
      .query(`UPDATE dbo.seasons SET is_current = @is_current, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.seasons WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: la temporada tiene equipos, partidos u otros datos asociados. Desactivala en su lugar.',
        );
      }
      throw err;
    }
  }

  // Un club puede participar en cualquier competición/temporada (§9/§21 del pedido de corrección
  // arquitectónica) -- ya no se exige que el equipo "pertenezca" a la competición de la temporada,
  // esa restricción fija ya no existe. season_teams es la única fuente real de participación.
  async addTeam(seasonId: number, teamId: number) {
    await this.getById(seasonId);
    const team = await this.pool.request().input('id', sql.Int, teamId).query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (team.recordset.length === 0) {
      throw new BadRequestException('El equipo indicado no existe');
    }

    try {
      await this.pool
        .request()
        .input('season_id', sql.Int, seasonId)
        .input('team_id', sql.Int, teamId)
        .query('INSERT INTO dbo.season_teams (season_id, team_id) VALUES (@season_id, @team_id)');
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ese equipo ya está participando en esta temporada');
      }
      throw err;
    }
    return this.getById(seasonId);
  }

  async removeTeam(seasonId: number, teamId: number) {
    await this.getById(seasonId);
    await this.pool
      .request()
      .input('season_id', sql.Int, seasonId)
      .input('team_id', sql.Int, teamId)
      .query('DELETE FROM dbo.season_teams WHERE season_id = @season_id AND team_id = @team_id');
    return this.getById(seasonId);
  }

  async getStandings(seasonId: number) {
    const season = await this.getById(seasonId);
    const pointsRule = await this.pool
      .request()
      .input('id', sql.Int, season.competitionId)
      .query('SELECT points_win, points_draw, points_loss FROM dbo.competitions WHERE id = @id');
    const { points_win: pointsWin, points_draw: pointsDraw, points_loss: pointsLoss } = pointsRule.recordset[0];

    const result = await this.pool
      .request()
      .input('season_id', sql.Int, seasonId)
      .query(
        `WITH season_matches AS (
           SELECT m.id AS match_id, m.home_team_id, m.away_team_id, ps.home_score, ps.away_score
           FROM dbo.matches m
           LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
           WHERE m.season_id = @season_id AND m.status = 'finished'
         ),
         team_rows AS (
           SELECT
             home_team_id AS team_id,
             home_score AS goals_for,
             away_score AS goals_against,
             CASE WHEN home_score IS NULL THEN NULL
                  WHEN home_score > away_score THEN 'W'
                  WHEN home_score = away_score THEN 'D'
                  ELSE 'L' END AS outcome,
             CASE WHEN home_score IS NULL THEN 1 ELSE 0 END AS missing_score
           FROM season_matches
           UNION ALL
           SELECT
             away_team_id AS team_id,
             away_score AS goals_for,
             home_score AS goals_against,
             CASE WHEN away_score IS NULL THEN NULL
                  WHEN away_score > home_score THEN 'W'
                  WHEN away_score = home_score THEN 'D'
                  ELSE 'L' END AS outcome,
             CASE WHEN away_score IS NULL THEN 1 ELSE 0 END AS missing_score
           FROM season_matches
         )
         SELECT
           t.id AS team_id,
           t.name AS team_name,
           SUM(CASE WHEN tr.outcome IS NOT NULL THEN 1 ELSE 0 END) AS played,
           SUM(CASE WHEN tr.outcome = 'W' THEN 1 ELSE 0 END) AS won,
           SUM(CASE WHEN tr.outcome = 'D' THEN 1 ELSE 0 END) AS drawn,
           SUM(CASE WHEN tr.outcome = 'L' THEN 1 ELSE 0 END) AS lost,
           SUM(tr.goals_for) AS goals_for,
           SUM(tr.goals_against) AS goals_against,
           SUM(ISNULL(tr.missing_score, 0)) AS matches_missing_score,
           t.added_points
         FROM dbo.season_teams st
         JOIN dbo.teams t ON t.id = st.team_id
         LEFT JOIN team_rows tr ON tr.team_id = t.id
         WHERE st.season_id = @season_id
         GROUP BY t.id, t.name, t.added_points`,
      );

    const rows = result.recordset.map((r) => {
      const won = r.won ?? 0;
      const drawn = r.drawn ?? 0;
      const lost = r.lost ?? 0;
      const goalsFor = r.goals_for ?? 0;
      const goalsAgainst = r.goals_against ?? 0;
      const points = won * pointsWin + drawn * pointsDraw + lost * pointsLoss + r.added_points;
      return {
        teamId: r.team_id,
        teamName: r.team_name,
        played: r.played ?? 0,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        addedPoints: r.added_points,
        points,
        matchesMissingScore: r.matches_missing_score ?? 0,
      };
    });

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.teamName.localeCompare(b.teamName, 'es');
    });

    const standings = rows.map((r, i) => ({ position: i + 1, ...r }));
    const totalMissingScore = rows.reduce((sum, r) => sum + r.matchesMissingScore, 0);

    return {
      standings,
      pointsRule: { win: pointsWin, draw: pointsDraw, loss: pointsLoss },
      warning:
        totalMissingScore > 0
          ? `${totalMissingScore} partido(s) finalizado(s) sin marcador de tiempo completo cargado -- excluido(s) del cálculo de goles y resultado.`
          : null,
    };
  }

  private async assertCompetitionExists(competitionId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, competitionId)
      .query('SELECT TOP 1 1 FROM dbo.competitions WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new BadRequestException('La competición indicada no existe');
    }
  }

  private assertValidDateRange(startDate?: string | null, endDate?: string | null) {
    if (!startDate || !endDate) return;
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de finalización');
    }
  }
}
