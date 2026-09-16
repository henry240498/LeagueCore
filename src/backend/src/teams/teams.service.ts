import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

const COLUMN_MAP: Record<string, string> = {
  competitionId: 'competition_id',
  venueId: 'venue_id',
  name: 'name',
  city: 'city',
  country: 'country',
  foundedYear: 'founded_year',
  managerName: 'manager_name',
  managerSince: 'manager_since',
  note: 'note',
  logoUrl: 'logo_url',
  status: 'status',
  addedPoints: 'added_points',
  clubId: 'club_id',
  category: 'category',
};

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
    out[camel] = row[snake];
  }
  if (row.competition_name !== undefined) out.competitionName = row.competition_name;
  return out;
}

export interface ListQuery {
  search?: string;
  status?: string;
  // Filtra por PARTICIPACIÓN real (season_teams -> seasons), no por una columna fija -- un club
  // puede haber participado en muchas competiciones (§9/§21 del pedido: "OLIMPIA no pertenece a
  // una sola competición"). Se conserva además el fallback a t.competition_id (legado, ver
  // migración 034) para los equipos reales que todavía no tienen ninguna fila en season_teams --
  // nunca se pierde esa señal, aunque sea incompleta.
  competitionId?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const SORTABLE_COLUMNS: Record<string, string> = {
  name: 't.name',
  status: 't.status',
  city: 't.city',
  createdAt: 't.created_at',
};

@Injectable()
export class TeamsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(query: ListQuery) {
    const request = this.pool.request();
    const conditions: string[] = [];

    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('t.name LIKE @search');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('t.status = @status');
    }
    if (query.competitionId) {
      request.input('competition_id', sql.Int, query.competitionId);
      conditions.push(
        `(t.competition_id = @competition_id OR EXISTS (
           SELECT 1 FROM dbo.season_teams st JOIN dbo.seasons se ON se.id = st.season_id
           WHERE st.team_id = t.id AND se.competition_id = @competition_id
         ))`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORTABLE_COLUMNS[query.sortBy ?? ''] ?? 't.name';
    const sortDir = query.sortDir === 'desc' ? 'DESC' : 'ASC';

    // LEFT JOIN (antes era JOIN): un club real puede no tener ninguna competición fija cargada
    // -- competition_name queda como dato de respaldo legado, nunca obligatorio.
    const result = await request.query(
      `SELECT t.*, c.name AS competition_name
       FROM dbo.teams t
       LEFT JOIN dbo.competitions c ON c.id = t.competition_id
       ${where}
       ORDER BY ${sortColumn} ${sortDir}`,
    );
    return result.recordset.map(toCamel);
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT t.*, c.name AS competition_name
         FROM dbo.teams t
         LEFT JOIN dbo.competitions c ON c.id = t.competition_id
         WHERE t.id = @id`,
      );
    if (result.recordset.length === 0) {
      throw new NotFoundException('Equipo no encontrado');
    }
    return toCamel(result.recordset[0]);
  }

  // Historial real de participación (§16 del pedido: "Historial de competiciones" en la vista de
  // equipo) -- viene de season_teams, la tabla de participación real, nunca de competition_id.
  // Agrupa por competición y lista las temporadas reales dentro de cada una.
  async getCompetitionsHistory(teamId: number) {
    await this.getById(teamId);
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .query(
        `SELECT c.id AS competition_id, c.name AS competition_name, c.country,
                s.id AS season_id, s.start_year, s.end_year, s.label
         FROM dbo.season_teams st
         JOIN dbo.seasons s ON s.id = st.season_id
         JOIN dbo.competitions c ON c.id = s.competition_id
         WHERE st.team_id = @team_id
         ORDER BY c.name, s.start_year DESC`,
      );
    const byCompetition = new Map<number, { competitionId: number; competitionName: string; country: string | null; seasons: { seasonId: number; label: string; startYear: number; endYear: number }[] }>();
    for (const r of result.recordset) {
      if (!byCompetition.has(r.competition_id)) {
        byCompetition.set(r.competition_id, { competitionId: r.competition_id, competitionName: r.competition_name, country: r.country, seasons: [] });
      }
      byCompetition.get(r.competition_id)!.seasons.push({ seasonId: r.season_id, label: r.label, startYear: r.start_year, endYear: r.end_year });
    }
    return Array.from(byCompetition.values());
  }

  async create(dto: CreateTeamDto) {
    if (dto.competitionId !== undefined) {
      await this.assertCompetitionExists(dto.competitionId);
    }
    if (dto.clubId !== undefined && dto.clubId !== null) {
      await this.assertClubExists(dto.clubId);
    }

    const request = this.pool.request();
    const columns: string[] = [];
    const params: string[] = [];
    for (const [camel, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const column = COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, value);
      columns.push(column);
      params.push(`@${column}`);
    }

    const result = await request.query(
      `INSERT INTO dbo.teams (${columns.join(', ')})
       OUTPUT INSERTED.id
       VALUES (${params.join(', ')})`,
    );
    return this.getById(result.recordset[0].id);
  }

  async update(id: number, dto: UpdateTeamDto) {
    await this.getById(id);
    if (dto.competitionId !== undefined) {
      await this.assertCompetitionExists(dto.competitionId);
    }
    if (dto.clubId !== undefined && dto.clubId !== null) {
      await this.assertClubExists(dto.clubId);
    }

    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.getById(id);

    const request = this.pool.request();
    const setClauses: string[] = [];
    for (const [camel, value] of entries) {
      const column = COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, value);
      setClauses.push(`${column} = @${column}`);
    }
    setClauses.push('updated_at = SYSUTCDATETIME()');
    request.input('id', sql.Int, id);

    await request.query(`UPDATE dbo.teams SET ${setClauses.join(', ')} WHERE id = @id`);
    return this.getById(id);
  }

  async setStatus(id: number, status: 'active' | 'inactive') {
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE dbo.teams SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.teams WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el equipo tiene jugadores o partidos asociados. Desactivalo en su lugar.',
        );
      }
      throw err;
    }
  }

  async getRosterHistory(teamId: number) {
    await this.getById(teamId);
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .query(
        `SELECT h.id, h.player_id, p.full_name AS player_name, h.squad_number, h.start_date, h.end_date
         FROM dbo.player_team_history h
         JOIN dbo.players p ON p.id = h.player_id
         WHERE h.team_id = @team_id
         ORDER BY h.start_date DESC, h.id DESC`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      playerName: r.player_name,
      squadNumber: r.squad_number,
      startDate: r.start_date,
      endDate: r.end_date,
    }));
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

  private async assertClubExists(clubId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, clubId)
      .query('SELECT TOP 1 1 FROM dbo.clubs WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new BadRequestException('El club indicado no existe');
    }
  }
}
