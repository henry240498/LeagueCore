import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateClubDto } from './dto/create-club.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateClubDto } from './dto/update-club.dto';

const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  shortName: 'short_name',
  country: 'country',
  city: 'city',
  foundedYear: 'founded_year',
  logoUrl: 'logo_url',
  primaryColor: 'primary_color',
  secondaryColor: 'secondary_color',
  history: 'history',
  status: 'status',
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
  return out as Record<string, any> & { id: number; name: string };
}

function toStaffCamel(r: Record<string, any>) {
  return {
    id: r.id,
    clubId: r.club_id,
    fullName: r.full_name,
    role: r.role,
    teamCategory: r.team_category,
    startDate: r.start_date,
    endDate: r.end_date,
    contact: r.contact,
    createdAt: r.created_at,
  };
}

@Injectable()
export class ClubsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(query: { search?: string; status?: string }) {
    const request = this.pool.request();
    const conditions: string[] = [];
    if (query.search) {
      request.input('search', sql.NVarChar, `%${query.search}%`);
      conditions.push('(c.name LIKE @search OR c.short_name LIKE @search)');
    }
    if (query.status) {
      request.input('status', sql.NVarChar, query.status);
      conditions.push('c.status = @status');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await request.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM dbo.teams t WHERE t.club_id = c.id) AS teams_count,
        (SELECT COUNT(*) FROM dbo.club_staff s WHERE s.club_id = c.id AND (s.end_date IS NULL OR s.end_date >= CAST(GETUTCDATE() AS DATE))) AS staff_count
       FROM dbo.clubs c ${where} ORDER BY c.name`,
    );
    return result.recordset.map((r) => ({ ...toCamel(r), teamsCount: r.teams_count, staffCount: r.staff_count }));
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT c.*,
          (SELECT COUNT(*) FROM dbo.teams t WHERE t.club_id = c.id) AS teams_count,
          (SELECT COUNT(*) FROM dbo.club_staff s WHERE s.club_id = c.id AND (s.end_date IS NULL OR s.end_date >= CAST(GETUTCDATE() AS DATE))) AS staff_count
         FROM dbo.clubs c WHERE c.id = @id`,
      );
    if (result.recordset.length === 0) throw new NotFoundException('Club no encontrado');
    const r = result.recordset[0];
    return { ...toCamel(r), teamsCount: r.teams_count, staffCount: r.staff_count };
  }

  async create(dto: CreateClubDto) {
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
    try {
      const result = await request.query(
        `INSERT INTO dbo.clubs (${columns.join(', ')}) OUTPUT INSERTED.id VALUES (${params.join(', ')})`,
      );
      return this.getById(result.recordset[0].id);
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe un club con ese nombre');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateClubDto) {
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
    try {
      await request.query(`UPDATE dbo.clubs SET ${setClauses.join(', ')} WHERE id = @id`);
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe un club con ese nombre');
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
      .query('UPDATE dbo.clubs SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id');
    return this.getById(id);
  }

  async remove(id: number) {
    await this.getById(id);
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.clubs WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el club tiene equipos o staff asociados. Desactivalo en su lugar.',
        );
      }
      throw err;
    }
  }

  // Equipos/categorias del club (cada fila de teams con club_id = club).
  async getTeams(clubId: number) {
    await this.getById(clubId);
    const result = await this.pool
      .request()
      .input('club_id', sql.Int, clubId)
      .query(
        `SELECT t.id, t.name, t.category, t.city, t.country, t.status, t.logo_url,
          (SELECT COUNT(*) FROM dbo.player_team_history h WHERE h.team_id = t.id AND h.end_date IS NULL) AS players_count
         FROM dbo.teams t WHERE t.club_id = @club_id ORDER BY t.category, t.name`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      city: r.city,
      country: r.country,
      status: r.status,
      logoUrl: r.logo_url,
      playersCount: r.players_count,
    }));
  }

  async linkTeam(clubId: number, teamId: number, category?: string) {
    await this.getById(clubId);
    const team = await this.pool
      .request()
      .input('id', sql.Int, teamId)
      .query('SELECT id FROM dbo.teams WHERE id = @id');
    if (team.recordset.length === 0) throw new NotFoundException('Equipo no encontrado');
    await this.pool
      .request()
      .input('club_id', sql.Int, clubId)
      .input('team_id', sql.Int, teamId)
      .input('category', sql.NVarChar, category ?? null)
      .query('UPDATE dbo.teams SET club_id = @club_id, category = @category, updated_at = SYSUTCDATETIME() WHERE id = @team_id');
    return this.getTeams(clubId);
  }

  async unlinkTeam(clubId: number, teamId: number) {
    await this.getById(clubId);
    await this.pool
      .request()
      .input('club_id', sql.Int, clubId)
      .input('team_id', sql.Int, teamId)
      .query('UPDATE dbo.teams SET club_id = NULL, updated_at = SYSUTCDATETIME() WHERE id = @team_id AND club_id = @club_id');
    return this.getTeams(clubId);
  }

  // Staff / cuerpo tecnico ---------------------------------------------------
  async getStaff(clubId: number) {
    await this.getById(clubId);
    const result = await this.pool
      .request()
      .input('club_id', sql.Int, clubId)
      .query('SELECT * FROM dbo.club_staff WHERE club_id = @club_id ORDER BY role, full_name');
    return result.recordset.map(toStaffCamel);
  }

  async addStaff(clubId: number, dto: CreateStaffDto) {
    await this.getById(clubId);
    const result = await this.pool
      .request()
      .input('club_id', sql.Int, clubId)
      .input('full_name', sql.NVarChar, dto.fullName)
      .input('role', sql.NVarChar, dto.role)
      .input('team_category', sql.NVarChar, dto.teamCategory ?? null)
      .input('start_date', sql.Date, dto.startDate ?? null)
      .input('end_date', sql.Date, dto.endDate ?? null)
      .input('contact', sql.NVarChar, dto.contact ?? null)
      .query(
        `INSERT INTO dbo.club_staff (club_id, full_name, role, team_category, start_date, end_date, contact)
         OUTPUT INSERTED.id VALUES (@club_id, @full_name, @role, @team_category, @start_date, @end_date, @contact)`,
      );
    const created = await this.pool
      .request()
      .input('id', sql.Int, result.recordset[0].id)
      .query('SELECT * FROM dbo.club_staff WHERE id = @id');
    return toStaffCamel(created.recordset[0]);
  }

  async removeStaff(clubId: number, staffId: number) {
    await this.getById(clubId);
    await this.pool
      .request()
      .input('club_id', sql.Int, clubId)
      .input('id', sql.Int, staffId)
      .query('DELETE FROM dbo.club_staff WHERE id = @id AND club_id = @club_id');
  }
}
