import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreatePhysicalRecordDto } from './dto/create-physical-record.dto';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreateInjuryDto, UpdateInjuryDto } from './dto/injury.dto';
import { SaveTechnicalRatingsDto } from './dto/save-technical-ratings.dto';
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
  weightKg: 'weight_kg',
  contractStatus: 'contract_status',
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
  weight_kg: sql.SmallInt,
  contract_status: sql.NVarChar,
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

function toPhysicalCamel(r: Record<string, any>) {
  return {
    id: r.id,
    playerId: r.player_id,
    recordedAt: r.recorded_at,
    maxSpeedKmh: r.max_speed_kmh,
    avgSpeedKmh: r.avg_speed_kmh,
    distanceM: r.distance_m,
    hiDistanceM: r.hi_distance_m,
    sprints: r.sprints,
    accelerations: r.accelerations,
    decelerations: r.decelerations,
    directionChanges: r.direction_changes,
    hiMinutes: r.hi_minutes,
    playerLoad: r.player_load,
    acwr: r.acwr,
    heartRateAvg: r.heart_rate_avg,
    externalLoad: r.external_load,
    internalLoad: r.internal_load,
    fatigue: r.fatigue,
    availability: r.availability,
    source: r.source,
    note: r.note,
    createdAt: r.created_at,
  };
}

function toTechnicalCamel(r: Record<string, any>) {
  return {
    id: r.id,
    playerId: r.player_id,
    attribute: r.attribute,
    value: r.value,
    evaluatedAt: r.evaluated_at,
    evaluator: r.evaluator,
  };
}

function toInjuryCamel(r: Record<string, any>) {
  return {
    id: r.id,
    playerId: r.player_id,
    injuryType: r.injury_type,
    bodyPart: r.body_part,
    severity: r.severity,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
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

  // --- Expediente avanzado (Fase 2) -------------------------------------------
  // Perfil agregado: jugador + ultimo fisico + tecnica vigente + lesion activa + evolucion.

  async getProfile(id: number) {
    const player = await this.getById(id);
    const [physical, technical, injuries] = await Promise.all([
      this.listPhysical(id, 12),
      this.getTechnical(id),
      this.listInjuries(id),
    ]);
    const activeInjury = injuries.find((i) => i.status === 'ACTIVA') ?? null;
    return {
      player,
      physicalLatest: physical[0] ?? null,
      physicalEvolution: [...physical].reverse(),
      technical,
      activeInjury,
      injuriesCount: injuries.length,
    };
  }

  async listPhysical(playerId: number, limit = 30) {
    await this.assertPlayerExists(playerId);
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('limit_n', sql.Int, Math.min(Math.max(limit, 1), 100))
      .query(
        `SELECT TOP (@limit_n) * FROM dbo.player_physical_records
         WHERE player_id = @player_id ORDER BY recorded_at DESC, id DESC`,
      );
    return result.recordset.map(toPhysicalCamel);
  }

  async addPhysical(playerId: number, dto: CreatePhysicalRecordDto) {
    await this.assertPlayerExists(playerId);
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('recorded_at', sql.Date, dto.recordedAt ?? new Date())
      .input('max_speed_kmh', sql.Decimal(5, 2), dto.maxSpeedKmh ?? null)
      .input('avg_speed_kmh', sql.Decimal(5, 2), dto.avgSpeedKmh ?? null)
      .input('distance_m', sql.Int, dto.distanceM ?? null)
      .input('hi_distance_m', sql.Int, dto.hiDistanceM ?? null)
      .input('sprints', sql.Int, dto.sprints ?? null)
      .input('accelerations', sql.Int, dto.accelerations ?? null)
      .input('decelerations', sql.Int, dto.decelerations ?? null)
      .input('direction_changes', sql.Int, dto.directionChanges ?? null)
      .input('hi_minutes', sql.Int, dto.hiMinutes ?? null)
      .input('player_load', sql.Decimal(8, 2), dto.playerLoad ?? null)
      .input('acwr', sql.Decimal(4, 2), dto.acwr ?? null)
      .input('heart_rate_avg', sql.SmallInt, dto.heartRateAvg ?? null)
      .input('external_load', sql.Decimal(8, 2), dto.externalLoad ?? null)
      .input('internal_load', sql.Decimal(8, 2), dto.internalLoad ?? null)
      .input('fatigue', sql.SmallInt, dto.fatigue ?? null)
      .input('availability', sql.NVarChar, dto.availability ?? 'DISPONIBLE')
      .input('source', sql.NVarChar, dto.source ?? 'manual')
      .input('note', sql.NVarChar, dto.note ?? null)
      .query(
        `INSERT INTO dbo.player_physical_records
          (player_id, recorded_at, max_speed_kmh, avg_speed_kmh, distance_m, hi_distance_m,
           sprints, accelerations, decelerations, direction_changes, hi_minutes, player_load, acwr,
           heart_rate_avg, external_load, internal_load, fatigue, availability, source, note)
         OUTPUT INSERTED.id
         VALUES (@player_id, @recorded_at, @max_speed_kmh, @avg_speed_kmh, @distance_m, @hi_distance_m,
           @sprints, @accelerations, @decelerations, @direction_changes, @hi_minutes, @player_load, @acwr,
           @heart_rate_avg, @external_load, @internal_load, @fatigue, @availability, @source, @note)`,
      );
    const created = await this.pool
      .request()
      .input('id', sql.Int, result.recordset[0].id)
      .query('SELECT * FROM dbo.player_physical_records WHERE id = @id');
    return toPhysicalCamel(created.recordset[0]);
  }

  async getTechnical(playerId: number) {
    await this.assertPlayerExists(playerId);
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT r.* FROM dbo.player_technical_ratings r
         JOIN (SELECT attribute, MAX(evaluated_at) AS max_date
               FROM dbo.player_technical_ratings WHERE player_id = @player_id GROUP BY attribute) m
           ON m.attribute = r.attribute AND m.max_date = r.evaluated_at
         WHERE r.player_id = @player_id`,
      );
    return result.recordset.map(toTechnicalCamel);
  }

  async saveTechnical(playerId: number, dto: SaveTechnicalRatingsDto) {
    await this.assertPlayerExists(playerId);
    if (!dto.ratings?.length) throw new BadRequestException('Debe enviar al menos una valoración');
    const evaluatedAt = dto.evaluatedAt ?? new Date().toISOString().slice(0, 10);
    for (const item of dto.ratings) {
      if (item.value < 1 || item.value > 100) {
        throw new BadRequestException(`Valor fuera de rango (1-100) para ${item.attribute}`);
      }
      await this.pool
        .request()
        .input('player_id', sql.Int, playerId)
        .input('attribute', sql.NVarChar, item.attribute)
        .input('value', sql.SmallInt, item.value)
        .input('evaluated_at', sql.Date, evaluatedAt)
        .input('evaluator', sql.NVarChar, dto.evaluator ?? null)
        .query(
          `MERGE dbo.player_technical_ratings AS t
           USING (SELECT @player_id AS player_id, @attribute AS attribute, @evaluated_at AS evaluated_at) AS s
           ON t.player_id = s.player_id AND t.attribute = s.attribute AND t.evaluated_at = s.evaluated_at
           WHEN MATCHED THEN UPDATE SET value = @value, evaluator = @evaluator
           WHEN NOT MATCHED THEN INSERT (player_id, attribute, value, evaluated_at, evaluator)
             VALUES (@player_id, @attribute, @value, @evaluated_at, @evaluator);`,
        );
    }
    return this.getTechnical(playerId);
  }

  async listInjuries(playerId: number) {
    await this.assertPlayerExists(playerId);
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query('SELECT * FROM dbo.player_injuries WHERE player_id = @player_id ORDER BY start_date DESC, id DESC');
    return result.recordset.map(toInjuryCamel);
  }

  async addInjury(playerId: number, dto: CreateInjuryDto) {
    await this.assertPlayerExists(playerId);
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('injury_type', sql.NVarChar, dto.injuryType)
      .input('body_part', sql.NVarChar, dto.bodyPart ?? null)
      .input('severity', sql.NVarChar, dto.severity ?? null)
      .input('start_date', sql.Date, dto.startDate)
      .input('end_date', sql.Date, dto.endDate ?? null)
      .input('note', sql.NVarChar, dto.note ?? null)
      .query(
        `INSERT INTO dbo.player_injuries (player_id, injury_type, body_part, severity, start_date, end_date, note)
         OUTPUT INSERTED.id VALUES (@player_id, @injury_type, @body_part, @severity, @start_date, @end_date, @note)`,
      );
    const created = await this.pool
      .request()
      .input('id', sql.Int, result.recordset[0].id)
      .query('SELECT * FROM dbo.player_injuries WHERE id = @id');
    return toInjuryCamel(created.recordset[0]);
  }

  async updateInjury(playerId: number, injuryId: number, dto: UpdateInjuryDto) {
    await this.assertPlayerExists(playerId);
    const existing = await this.pool
      .request()
      .input('id', sql.Int, injuryId)
      .input('player_id', sql.Int, playerId)
      .query('SELECT id FROM dbo.player_injuries WHERE id = @id AND player_id = @player_id');
    if (existing.recordset.length === 0) throw new NotFoundException('Lesión no encontrada');
    const map: Record<string, string> = {
      injuryType: 'injury_type',
      bodyPart: 'body_part',
      severity: 'severity',
      startDate: 'start_date',
      endDate: 'end_date',
      status: 'status',
      note: 'note',
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
      request.input('id', sql.Int, injuryId);
      await request.query(`UPDATE dbo.player_injuries SET ${sets.join(', ')} WHERE id = @id`);
    }
    const updated = await this.pool
      .request()
      .input('id', sql.Int, injuryId)
      .query('SELECT * FROM dbo.player_injuries WHERE id = @id');
    return toInjuryCamel(updated.recordset[0]);
  }

  async removeInjury(playerId: number, injuryId: number) {
    await this.assertPlayerExists(playerId);
    await this.pool
      .request()
      .input('id', sql.Int, injuryId)
      .input('player_id', sql.Int, playerId)
      .query('DELETE FROM dbo.player_injuries WHERE id = @id AND player_id = @player_id');
  }

  private async assertPlayerExists(playerId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, playerId)
      .query('SELECT TOP 1 1 FROM dbo.players WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Jugador no encontrado');
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
