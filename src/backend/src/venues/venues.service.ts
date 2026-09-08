import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

// Igual criterio que Coaches: reutiliza dbo.venues (ya existía desde la migración 001) con
// un backend mínimo — buscador + alta rápida desde el formulario de Partidos, sin un módulo
// completo de Estadios (deliberadamente fuera de alcance, ver §11 del pedido de Partidos).
function toCamel(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    capacity: row.capacity,
    openedYear: row.opened_year,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  };
}

@Injectable()
export class VenuesService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(search?: string) {
    const request = this.pool.request();
    let where = '';
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      where = 'WHERE name LIKE @search';
    }
    const result = await request.query(`SELECT * FROM dbo.venues ${where} ORDER BY name`);
    return result.recordset.map(toCamel);
  }

  async getById(id: number) {
    const result = await this.pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.venues WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Estadio no encontrado');
    return toCamel(result.recordset[0]);
  }

  async create(dto: CreateVenueDto) {
    const result = await this.pool
      .request()
      .input('name', sql.NVarChar, dto.name)
      .input('city', sql.NVarChar, dto.city ?? null)
      .input('country', sql.NVarChar, dto.country ?? null)
      .input('capacity', sql.Int, dto.capacity ?? null)
      .input('opened_year', sql.SmallInt, dto.openedYear ?? null)
      .query(
        `INSERT INTO dbo.venues (name, city, country, capacity, opened_year)
         OUTPUT INSERTED.id
         VALUES (@name, @city, @country, @capacity, @opened_year)`,
      );
    return this.getById(result.recordset[0].id);
  }

  // Foto real del estadio (§18/§25 del pedido de interfaz visual: "si hay cancha registrada, usar
  // su foto real; si no, un genérico") -- sin esto no había ningún campo de imagen en dbo.venues.
  async setPhoto(id: number, photoUrl: string) {
    await this.getById(id);
    await this.pool.request().input('id', sql.Int, id).input('photo_url', sql.NVarChar, photoUrl).query(
      'UPDATE dbo.venues SET photo_url = @photo_url WHERE id = @id',
    );
    return this.getById(id);
  }

  async update(id: number, dto: UpdateVenueDto) {
    await this.getById(id);
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.getById(id);

    const columnMap: Record<string, string> = {
      name: 'name',
      city: 'city',
      country: 'country',
      capacity: 'capacity',
      openedYear: 'opened_year',
    };

    const request = this.pool.request();
    const setClauses: string[] = [];
    for (const [camel, value] of entries) {
      const column = columnMap[camel];
      if (!column) continue;
      request.input(column, value);
      setClauses.push(`${column} = @${column}`);
    }
    request.input('id', sql.Int, id);

    await request.query(`UPDATE dbo.venues SET ${setClauses.join(', ')} WHERE id = @id`);
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.venues WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el estadio tiene partidos o equipos asociados.',
        );
      }
      throw err;
    }
  }
}
