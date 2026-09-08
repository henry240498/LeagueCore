import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

const COLUMN_MAP: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  birthPlace: 'birth_place',
  nationality: 'nationality',
  position: 'position',
  squadNumber: 'squad_number',
  heightCm: 'height_cm',
  preferredFoot: 'preferred_foot',
  teamId: 'team_id',
  status: 'status',
  photoUrl: 'photo_url',
};

// A diferencia de competitions/teams (que sólo escriben valores definidos, nunca NULL explícito),
// Jugadores necesita poder "vaciar" teamId (dejar al jugador sin equipo actual) — mssql no puede
// inferir el tipo SQL de un `null` de JS sin ayuda, así que acá el tipo se especifica siempre.
const COLUMN_TYPES: Record<string, (() => sql.ISqlType) | sql.ISqlType> = {
  first_name: sql.NVarChar,
  last_name: sql.NVarChar,
  date_of_birth: sql.Date,
  birth_place: sql.NVarChar,
  nationality: sql.NVarChar,
  position: sql.NVarChar,
  squad_number: sql.SmallInt,
  height_cm: sql.SmallInt,
  preferred_foot: sql.NVarChar,
  team_id: sql.Int,
  status: sql.NVarChar,
  photo_url: sql.NVarChar,
};

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fullName: row.full_name,
    dataOrigin: row.data_origin,
    externalSource: row.external_source,
    externalId: row.external_id,
    externalUrl: row.external_url,
    lastSyncedAt: row.last_synced_at,
  };
  for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
    out[camel] = row[snake];
  }
  if (row.team_name !== undefined) out.teamName = row.team_name;
  return out;
}

export interface ListQuery {
  search?: string;
  teamId?: number;
  competitionId?: number;
  position?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  fullName: 'p.full_name',
  lastName: 'p.last_name',
  position: 'p.position',
  status: 'p.status',
  teamName: 't.name',
  createdAt: 'p.created_at',
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class PlayersService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(query: ListQuery) {
    const request = this.pool.request();
    const conditions: string[] = [];

    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('p.full_name LIKE @search');
    }
    if (query.teamId) {
      request.input('team_id', sql.Int, query.teamId);
      conditions.push('p.team_id = @team_id');
    }
    if (query.competitionId) {
      // Filtra por PARTICIPACIÓN real del equipo actual del jugador (season_teams -> seasons),
      // nunca por t.competition_id -- un club puede participar en muchas competiciones (§21 del
      // pedido de corrección arquitectónica).
      request.input('competition_id', sql.Int, query.competitionId);
      conditions.push(
        `EXISTS (SELECT 1 FROM dbo.season_teams st JOIN dbo.seasons se ON se.id = st.season_id WHERE st.team_id = t.id AND se.competition_id = @competition_id)`,
      );
    }
    if (query.position) {
      request.input('position', sql.NVarChar, query.position);
      conditions.push('p.position = @position');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('p.status = @status');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORTABLE_COLUMNS[query.sortBy ?? ''] ?? 'p.full_name';
    const sortDir = query.sortDir === 'desc' ? 'DESC' : 'ASC';

    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const offset = (page - 1) * pageSize;
    request.input('offset', sql.Int, offset);
    request.input('page_size', sql.Int, pageSize);

    const result = await request.query(
      `SELECT p.*, t.name AS team_name,
              COUNT(*) OVER() AS total_count
       FROM dbo.players p
       LEFT JOIN dbo.teams t ON t.id = p.team_id
       ${where}
       ORDER BY ${sortColumn} ${sortDir}
       OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
    );

    return {
      items: result.recordset.map(toCamel),
      total: result.recordset[0]?.total_count ?? 0,
      page,
      pageSize,
    };
  }

  async checkDuplicates(firstName: string, lastName: string) {
    const trimmedLast = lastName.trim();
    if (trimmedLast.length < 2) return [];

    const result = await this.pool
      .request()
      .input('lastName', sql.NVarChar, trimmedLast)
      .input('firstNameLike', sql.NVarChar, `%${firstName.trim()}%`)
      .query(
        // COLLATE ...CI_AI sólo en esta consulta (no toca el collation de la columna/tabla): hace
        // la comparación insensible a mayúsculas/tildes para el chequeo de "posible duplicado" —
        // Modern_Spanish_CI_AS (el collation real de la base) es sensible a tildes por defecto,
        // lo que dejaría pasar "José" vs "Jose" como registros distintos.
        `SELECT TOP 5 p.id, p.full_name, p.date_of_birth, p.nationality, t.name AS team_name
         FROM dbo.players p
         LEFT JOIN dbo.teams t ON t.id = p.team_id
         WHERE p.last_name COLLATE Latin1_General_CI_AI = @lastName COLLATE Latin1_General_CI_AI
            OR (
                 p.full_name COLLATE Latin1_General_CI_AI LIKE '%' + @lastName COLLATE Latin1_General_CI_AI + '%'
                 AND p.first_name COLLATE Latin1_General_CI_AI LIKE @firstNameLike COLLATE Latin1_General_CI_AI
               )`,
      );

    return result.recordset.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      dateOfBirth: r.date_of_birth,
      nationality: r.nationality,
      teamName: r.team_name,
    }));
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT p.*, t.name AS team_name
         FROM dbo.players p
         LEFT JOIN dbo.teams t ON t.id = p.team_id
         WHERE p.id = @id`,
      );
    if (result.recordset.length === 0) {
      throw new NotFoundException('Jugador no encontrado');
    }
    const player = toCamel(result.recordset[0]);

    const history = await this.pool
      .request()
      .input('player_id', sql.Int, id)
      .query(
        `SELECT h.id, h.team_id, tm.name AS team_name, h.start_date, h.end_date, h.squad_number,
                h.season_id, s.label AS season_label
         FROM dbo.player_team_history h
         JOIN dbo.teams tm ON tm.id = h.team_id
         LEFT JOIN dbo.seasons s ON s.id = h.season_id
         WHERE h.player_id = @player_id
         ORDER BY h.start_date DESC, h.id DESC`,
      );
    player.teamHistory = history.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      startDate: r.start_date,
      endDate: r.end_date,
      squadNumber: r.squad_number,
      seasonId: r.season_id,
      seasonLabel: r.season_label,
    }));

    return player;
  }

  async create(dto: CreatePlayerDto) {
    this.assertValidDateOfBirth(dto.dateOfBirth);
    if (dto.teamId) await this.assertTeamExists(dto.teamId);

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
      `INSERT INTO dbo.players (${columns.join(', ')})
       OUTPUT INSERTED.id
       VALUES (${params.join(', ')})`,
    );
    const id = result.recordset[0].id;

    if (dto.teamId) {
      await this.openTeamStint(id, dto.teamId, dto.squadNumber ?? undefined);
    }

    return this.getById(id);
  }

  async update(id: number, dto: UpdatePlayerDto) {
    const current = await this.getById(id);
    if (dto.dateOfBirth !== undefined) this.assertValidDateOfBirth(dto.dateOfBirth);
    if (dto.teamId) await this.assertTeamExists(dto.teamId);

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
      await request.query(`UPDATE dbo.players SET ${setClauses.join(', ')} WHERE id = @id`);
    }

    if (dto.teamId !== undefined && dto.teamId !== current.teamId) {
      await this.closeOpenStint(id);
      if (dto.teamId) await this.openTeamStint(id, dto.teamId, dto.squadNumber ?? undefined);
    } else if (dto.squadNumber !== undefined && current.teamId) {
      await this.updateOpenStintSquadNumber(id, dto.squadNumber ?? undefined);
    }

    return this.getById(id);
  }

  async setStatus(id: number, status: 'active' | 'inactive') {
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE dbo.players SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.players WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el jugador tiene historial de equipos, goles, tarjetas u otros datos asociados. Desactivalo en su lugar.',
        );
      }
      throw err;
    }
  }

  private async assertTeamExists(teamId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, teamId)
      .query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new BadRequestException('El equipo indicado no existe');
    }
  }

  private assertValidDateOfBirth(dateOfBirth?: string | null) {
    if (!dateOfBirth) return;
    const parsed = new Date(dateOfBirth);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Fecha de nacimiento inválida');
    }
    if (parsed > new Date()) {
      throw new BadRequestException('La fecha de nacimiento no puede ser futura');
    }
    if (parsed < new Date('1900-01-01')) {
      throw new BadRequestException('La fecha de nacimiento no es válida');
    }
  }

  private async openTeamStint(playerId: number, teamId: number, squadNumber?: number) {
    await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('team_id', sql.Int, teamId)
      .input('squad_number', sql.SmallInt, squadNumber ?? null)
      .query(
        `INSERT INTO dbo.player_team_history (player_id, team_id, squad_number)
         VALUES (@player_id, @team_id, @squad_number)`,
      );
  }

  private async closeOpenStint(playerId: number) {
    await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `UPDATE dbo.player_team_history
         SET end_date = CAST(SYSUTCDATETIME() AS DATE), updated_at = SYSUTCDATETIME()
         WHERE player_id = @player_id AND end_date IS NULL`,
      );
  }

  private async updateOpenStintSquadNumber(playerId: number, squadNumber?: number) {
    await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('squad_number', sql.SmallInt, squadNumber ?? null)
      .query(
        `UPDATE dbo.player_team_history
         SET squad_number = @squad_number, updated_at = SYSUTCDATETIME()
         WHERE player_id = @player_id AND end_date IS NULL`,
      );
  }

  // Posiciones reales de este jugador a través de TODOS sus partidos (dbo.match_player_positions,
  // esquema listo desde 2026-08-24, 0 filas reales hoy en toda la base) -- alimenta la cancha del
  // perfil del jugador (mapa de calor/recorrido). Sólo lectura, nunca inventa una posición.
  async listPositions(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT mpp.id, mpp.match_id, mpp.period, mpp.minute, mpp.pos_x, mpp.pos_y, mpp.weight,
                m.match_date, ht.name AS home_team_name, at.name AS away_team_name
         FROM dbo.match_player_positions mpp
         JOIN dbo.matches m ON m.id = mpp.match_id
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         WHERE mpp.player_id = @player_id
         ORDER BY m.match_date, mpp.minute`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      matchId: r.match_id,
      period: r.period,
      minute: r.minute,
      posX: r.pos_x,
      posY: r.pos_y,
      weight: r.weight,
      matchDate: r.match_date,
      matchLabel: `${r.home_team_name} vs ${r.away_team_name}`,
    }));
  }
}
