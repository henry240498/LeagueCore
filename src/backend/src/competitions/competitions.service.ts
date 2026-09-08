import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  description: 'description',
  competitionType: 'competition_type',
  sport: 'sport',
  country: 'country',
  status: 'status',
  startDate: 'start_date',
  endDate: 'end_date',
  organization: 'organization',
  logoUrl: 'logo_url',
  observations: 'observations',
  seasonYear: 'season_year',
  pointsWin: 'points_win',
  pointsDraw: 'points_draw',
  pointsLoss: 'points_loss',
  autoPromotionSlots: 'auto_promotion_slots',
  autoRelegationSlots: 'auto_relegation_slots',
  promotionPlayoffSlots: 'promotion_playoff_slots',
  relegationPlayoffSlots: 'relegation_playoff_slots',
  matchDurationMinutes: 'match_duration_minutes',
  periodsPerMatch: 'periods_per_match',
};

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
  for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
    out[camel] = row[snake];
  }
  return out;
}

export interface ListQuery {
  search?: string;
  status?: string;
  sport?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const SORTABLE_COLUMNS: Record<string, string> = {
  name: 'name',
  status: 'status',
  startDate: 'start_date',
  seasonYear: 'season_year',
  createdAt: 'created_at',
};

@Injectable()
export class CompetitionsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(query: ListQuery) {
    const request = this.pool.request();
    const conditions: string[] = [];

    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('name LIKE @search');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('status = @status');
    }
    if (query.sport) {
      request.input('sport', sql.NVarChar, query.sport);
      conditions.push('sport = @sport');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORTABLE_COLUMNS[query.sortBy ?? ''] ?? 'name';
    const sortDir = query.sortDir === 'desc' ? 'DESC' : 'ASC';

    const result = await request.query(
      `SELECT * FROM dbo.competitions ${where} ORDER BY ${sortColumn} ${sortDir}`,
    );
    return result.recordset.map(toCamel);
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.competitions WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new NotFoundException('Competición no encontrada');
    }
    return toCamel(result.recordset[0]);
  }

  async create(dto: CreateCompetitionDto) {
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
      `INSERT INTO dbo.competitions (${columns.join(', ')})
       OUTPUT INSERTED.*
       VALUES (${params.join(', ')})`,
    );
    return toCamel(result.recordset[0]);
  }

  async update(id: number, dto: UpdateCompetitionDto) {
    await this.getById(id);

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

    await request.query(
      `UPDATE dbo.competitions SET ${setClauses.join(', ')} WHERE id = @id`,
    );
    return this.getById(id);
  }

  async setStatus(id: number, status: 'active' | 'inactive') {
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query(
        `UPDATE dbo.competitions SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`,
      );
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool
        .request()
        .input('id', sql.Int, id)
        .query('DELETE FROM dbo.competitions WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: la competición tiene equipos u otros datos asociados. Desactivala en su lugar.',
        );
      }
      throw err;
    }
  }
}
