import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateInformalTournamentDto } from './dto/create-informal-tournament.dto';
import { UpdateInformalTournamentDto } from './dto/update-informal-tournament.dto';

const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  sport: 'sport',
  format: 'format',
  status: 'status',
  location: 'location',
  startDate: 'start_date',
  endDate: 'end_date',
  maxTeams: 'max_teams',
  organizer: 'organizer',
  contact: 'contact',
  participants: 'participants',
  observations: 'observations',
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
  format?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const SORTABLE_COLUMNS: Record<string, string> = {
  name: 'name',
  status: 'status',
  startDate: 'start_date',
  createdAt: 'created_at',
};

@Injectable()
export class InformalTournamentsService {
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
    if (query.format) {
      request.input('format', sql.NVarChar, query.format);
      conditions.push('format = @format');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORTABLE_COLUMNS[query.sortBy ?? ''] ?? 'created_at';
    const sortDir = query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const result = await request.query(
      `SELECT * FROM dbo.informal_tournaments ${where} ORDER BY ${sortColumn} ${sortDir}`,
    );
    return result.recordset.map(toCamel);
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.informal_tournaments WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new NotFoundException('Torneo informal no encontrado');
    }
    return toCamel(result.recordset[0]);
  }

  async create(dto: CreateInformalTournamentDto) {
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

    if (columns.length === 0) {
      throw new BadRequestException('No hay datos para crear el torneo');
    }

    const result = await request.query(
      `INSERT INTO dbo.informal_tournaments (${columns.join(', ')})
       OUTPUT INSERTED.*
       VALUES (${params.join(', ')})`,
    );
    return toCamel(result.recordset[0]);
  }

  async update(id: number, dto: UpdateInformalTournamentDto) {
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
      `UPDATE dbo.informal_tournaments SET ${setClauses.join(', ')} WHERE id = @id`,
    );
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.informal_tournaments WHERE id = @id');
  }
}
