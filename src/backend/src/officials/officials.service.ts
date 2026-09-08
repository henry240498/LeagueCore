import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateOfficialDto } from './dto/create-official.dto';
import { UpdateOfficialDto } from './dto/update-official.dto';

const COLUMN_MAP: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  nationality: 'nationality',
  city: 'city',
  officialTypeId: 'official_type_id',
  status: 'status',
  photoUrl: 'photo_url',
};

// Igual que en PlayersService: se necesita poder "vaciar" officialTypeId/city/etc. con un null
// explícito, y mssql no infiere el tipo SQL de un `null` de JS sin ayuda.
const COLUMN_TYPES: Record<string, (() => sql.ISqlType) | sql.ISqlType> = {
  first_name: sql.NVarChar,
  last_name: sql.NVarChar,
  date_of_birth: sql.Date,
  nationality: sql.NVarChar,
  city: sql.NVarChar,
  official_type_id: sql.Int,
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
  if (row.official_type_name !== undefined) out.officialTypeName = row.official_type_name;
  return out;
}

export interface ListQuery {
  search?: string;
  officialTypeId?: number;
  nationality?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  fullName: 'o.full_name',
  lastName: 'o.last_name',
  nationality: 'o.nationality',
  status: 'o.status',
  officialTypeName: 'ot.name',
  createdAt: 'o.created_at',
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class OfficialsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(query: ListQuery) {
    const request = this.pool.request();
    const conditions: string[] = [];

    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('o.full_name LIKE @search');
    }
    if (query.officialTypeId) {
      request.input('official_type_id', sql.Int, query.officialTypeId);
      conditions.push('o.official_type_id = @official_type_id');
    }
    if (query.nationality) {
      request.input('nationality', sql.NVarChar, query.nationality);
      conditions.push('o.nationality = @nationality');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('o.status = @status');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORTABLE_COLUMNS[query.sortBy ?? ''] ?? 'o.full_name';
    const sortDir = query.sortDir === 'desc' ? 'DESC' : 'ASC';

    const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(query.page ?? 1, 1);
    const offset = (page - 1) * pageSize;
    request.input('offset', sql.Int, offset);
    request.input('page_size', sql.Int, pageSize);

    const result = await request.query(
      `SELECT o.*, ot.name AS official_type_name, COUNT(*) OVER() AS total_count
       FROM dbo.officials o
       LEFT JOIN dbo.official_types ot ON ot.id = o.official_type_id
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

  // Alimenta el filtro "Nacionalidad" del listado con valores reales (nunca un catálogo
  // inventado) — sólo nacionalidades que efectivamente tiene algún oficial cargado.
  async listNationalities() {
    const result = await this.pool
      .request()
      .query(
        `SELECT DISTINCT nationality FROM dbo.officials
         WHERE nationality IS NOT NULL AND nationality <> ''
         ORDER BY nationality`,
      );
    return result.recordset.map((r) => r.nationality as string);
  }

  async checkDuplicates(firstName: string, lastName: string) {
    const trimmedLast = lastName.trim();
    if (trimmedLast.length < 2) return [];

    const result = await this.pool
      .request()
      .input('lastName', sql.NVarChar, trimmedLast)
      .input('firstNameLike', sql.NVarChar, `%${firstName.trim()}%`)
      .query(
        // Mismo criterio que en PlayersService.checkDuplicates: COLLATE ...CI_AI sólo acá, para
        // que el chequeo de "posible duplicado" ignore mayúsculas/tildes sin tocar el collation
        // real de la tabla (Modern_Spanish_CI_AS, sensible a tildes).
        `SELECT TOP 5 o.id, o.full_name, o.date_of_birth, o.nationality, ot.name AS official_type_name
         FROM dbo.officials o
         LEFT JOIN dbo.official_types ot ON ot.id = o.official_type_id
         WHERE o.last_name COLLATE Latin1_General_CI_AI = @lastName COLLATE Latin1_General_CI_AI
            OR (
                 o.full_name COLLATE Latin1_General_CI_AI LIKE '%' + @lastName COLLATE Latin1_General_CI_AI + '%'
                 AND o.first_name COLLATE Latin1_General_CI_AI LIKE @firstNameLike COLLATE Latin1_General_CI_AI
               )`,
      );

    return result.recordset.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      dateOfBirth: r.date_of_birth,
      nationality: r.nationality,
      officialTypeName: r.official_type_name,
    }));
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT o.*, ot.name AS official_type_name
         FROM dbo.officials o
         LEFT JOIN dbo.official_types ot ON ot.id = o.official_type_id
         WHERE o.id = @id`,
      );
    if (result.recordset.length === 0) {
      throw new NotFoundException('Oficial no encontrado');
    }
    return toCamel(result.recordset[0]);
  }

  async create(dto: CreateOfficialDto) {
    this.assertValidDateOfBirth(dto.dateOfBirth);
    await this.assertOfficialTypeExists(dto.officialTypeId);

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
      `INSERT INTO dbo.officials (${columns.join(', ')})
       OUTPUT INSERTED.id
       VALUES (${params.join(', ')})`,
    );
    return this.getById(result.recordset[0].id);
  }

  async update(id: number, dto: UpdateOfficialDto) {
    await this.getById(id);
    if (dto.dateOfBirth !== undefined) this.assertValidDateOfBirth(dto.dateOfBirth);
    if (dto.officialTypeId) await this.assertOfficialTypeExists(dto.officialTypeId);

    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.getById(id);

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
    await request.query(`UPDATE dbo.officials SET ${setClauses.join(', ')} WHERE id = @id`);

    return this.getById(id);
  }

  async setStatus(id: number, status: 'active' | 'inactive') {
    await this.getById(id);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE dbo.officials SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.officials WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el oficial tiene partidos u otros datos asociados. Desactivalo en su lugar.',
        );
      }
      throw err;
    }
  }

  private async assertOfficialTypeExists(officialTypeId?: number | null) {
    if (!officialTypeId) return;
    const result = await this.pool
      .request()
      .input('id', sql.Int, officialTypeId)
      .query('SELECT TOP 1 1 FROM dbo.official_types WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new BadRequestException('El tipo de oficial indicado no existe');
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
}
