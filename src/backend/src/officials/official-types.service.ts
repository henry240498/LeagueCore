import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateOfficialTypeDto } from './dto/create-official-type.dto';

function toCamel(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

@Injectable()
export class OfficialTypesService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list() {
    const result = await this.pool
      .request()
      .query('SELECT * FROM dbo.official_types ORDER BY sort_order, name');
    return result.recordset.map(toCamel);
  }

  async create(dto: CreateOfficialTypeDto) {
    const name = dto.name.trim();
    try {
      const result = await this.pool
        .request()
        .input('name', sql.NVarChar, name)
        .query(
          `INSERT INTO dbo.official_types (name, sort_order)
           OUTPUT INSERTED.*
           VALUES (@name, (SELECT ISNULL(MAX(sort_order), 0) + 1 FROM dbo.official_types))`,
        );
      return toCamel(result.recordset[0]);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ya existe un tipo de oficial con ese nombre');
      }
      throw err;
    }
  }

  async setStatus(id: number, status: 'active' | 'inactive') {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query('UPDATE dbo.official_types SET status = @status OUTPUT INSERTED.* WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new NotFoundException('Tipo de oficial no encontrado');
    }
    return toCamel(result.recordset[0]);
  }
}
