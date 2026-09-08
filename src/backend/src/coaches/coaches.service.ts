import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateCoachDto } from './dto/create-coach.dto';

// Módulo deliberadamente mínimo (ver docs/ANALISIS_INICIAL_LEAGUECORE.md, changelog de
// Partidos): no tiene pantallas de listado/detalle propias todavía — se usa desde un buscador
// con alta rápida embebido en el formulario de Partidos (Cuerpo técnico). Si más adelante
// se necesita un directorio completo de entrenadores, este es el punto de partida, ya con el
// mismo modelo de datos que Jugadores/Oficiales (nombre nunca editable aparte, procedencia).
function toCamel(row: Record<string, any>) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    nationality: row.nationality,
    photoUrl: row.photo_url,
    status: row.status,
    dataOrigin: row.data_origin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class CoachesService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(search?: string) {
    const request = this.pool.request();
    let where = "WHERE status = 'active'";
    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
      where += ' AND full_name LIKE @search';
    }
    const result = await request.query(`SELECT * FROM dbo.coaches ${where} ORDER BY full_name`);
    return result.recordset.map(toCamel);
  }

  async getById(id: number) {
    const result = await this.pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.coaches WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Entrenador no encontrado');
    return toCamel(result.recordset[0]);
  }

  async create(dto: CreateCoachDto) {
    const result = await this.pool
      .request()
      .input('first_name', sql.NVarChar, dto.firstName)
      .input('last_name', sql.NVarChar, dto.lastName)
      .input('nationality', sql.NVarChar, dto.nationality ?? null)
      .input('status', sql.NVarChar, dto.status ?? 'active')
      .input('photo_url', sql.NVarChar, dto.photoUrl ?? null)
      .query(
        `INSERT INTO dbo.coaches (first_name, last_name, nationality, status, photo_url)
         OUTPUT INSERTED.id
         VALUES (@first_name, @last_name, @nationality, @status, @photo_url)`,
      );
    return this.getById(result.recordset[0].id);
  }
}
