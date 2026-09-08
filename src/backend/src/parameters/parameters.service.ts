import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { UpdateParameterDto } from './dto/update-parameter.dto';

function toCamelCategory(row: Record<string, any>) {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    usedIn: row.used_in,
    createdAt: row.created_at,
  };
}

function toCamelParameter(row: Record<string, any>) {
  return {
    id: row.id,
    categoryCode: row.category_code,
    code: row.code,
    label: row.label,
    sortOrder: row.sort_order,
    isActive: !!row.is_active,
    isSystem: !!row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Dónde vive cada categoría en el dominio real, usada sólo para bloquear el borrado de un valor
// todavía en uso (mismo criterio de "no romper integridad" que el resto del proyecto, aplicado acá
// a mano porque estas columnas son texto de aplicación, no una FK real hacia dbo.parameters).
const USAGE_LOOKUP: Record<string, { table: string; column: string } | null> = {
  match_status: { table: 'dbo.matches', column: 'status' },
  match_official_role: { table: 'dbo.match_officials', column: 'role' },
  coach_role: { table: 'dbo.match_coaches', column: 'role' },
  card_type: { table: 'dbo.cards', column: 'card_type' },
  goal_type: { table: 'dbo.goals', column: 'goal_type' },
  interruption_type: { table: 'dbo.match_interruptions', column: 'interruption_type' },
  pitch_condition: { table: 'dbo.matches', column: 'pitch_condition' },
  weather_condition: { table: 'dbo.matches', column: 'weather_condition' },
  player_position: null, // dos tablas (players.position y match_lineups.position); se omite el chequeo de uso
  competition_type: { table: 'dbo.competitions', column: 'competition_type' },
};

@Injectable()
export class ParametersService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async listCategories() {
    const result = await this.pool.request().query('SELECT * FROM dbo.parameter_categories ORDER BY name');
    return result.recordset.map(toCamelCategory);
  }

  async getCategory(code: string) {
    const result = await this.pool
      .request()
      .input('code', sql.NVarChar, code)
      .query('SELECT * FROM dbo.parameter_categories WHERE code = @code');
    if (result.recordset.length === 0) {
      throw new NotFoundException('Categoría de parametrización no encontrada');
    }
    return toCamelCategory(result.recordset[0]);
  }

  async listParameters(categoryCode: string, includeInactive = false) {
    await this.getCategory(categoryCode);
    const request = this.pool.request().input('category_code', sql.NVarChar, categoryCode);
    const activeFilter = includeInactive ? '' : 'AND is_active = 1';
    const result = await request.query(
      `SELECT * FROM dbo.parameters WHERE category_code = @category_code ${activeFilter} ORDER BY sort_order, label`,
    );
    return result.recordset.map(toCamelParameter);
  }

  async getActiveCodes(categoryCode: string): Promise<string[]> {
    const result = await this.pool
      .request()
      .input('category_code', sql.NVarChar, categoryCode)
      .query('SELECT code FROM dbo.parameters WHERE category_code = @category_code AND is_active = 1');
    return result.recordset.map((r) => r.code);
  }

  async assertActiveCode(categoryCode: string, code: string, fieldLabel: string) {
    const codes = await this.getActiveCodes(categoryCode);
    if (!codes.includes(code)) {
      throw new BadRequestException(
        `${fieldLabel} inválido: "${code}". Valores permitidos: ${codes.join(', ')}`,
      );
    }
  }

  async create(categoryCode: string, dto: CreateParameterDto) {
    await this.getCategory(categoryCode);
    try {
      const result = await this.pool
        .request()
        .input('category_code', sql.NVarChar, categoryCode)
        .input('code', sql.NVarChar, dto.code)
        .input('label', sql.NVarChar, dto.label)
        .input('sort_order', sql.Int, dto.sortOrder ?? 0)
        .query(
          `INSERT INTO dbo.parameters (category_code, code, label, sort_order, is_system)
           OUTPUT INSERTED.id
           VALUES (@category_code, @code, @label, @sort_order, 0)`,
        );
      return this.getById(result.recordset[0].id);
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ya existe un valor con ese código en esta categoría');
      }
      throw err;
    }
  }

  async getById(id: number) {
    const result = await this.pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.parameters WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new NotFoundException('Parámetro no encontrado');
    }
    return toCamelParameter(result.recordset[0]);
  }

  async update(id: number, dto: UpdateParameterDto) {
    const current = await this.getById(id);
    const request = this.pool.request().input('id', sql.Int, id);
    const setClauses: string[] = [];
    if (dto.label !== undefined) {
      request.input('label', sql.NVarChar, dto.label);
      setClauses.push('label = @label');
    }
    if (dto.sortOrder !== undefined) {
      request.input('sort_order', sql.Int, dto.sortOrder);
      setClauses.push('sort_order = @sort_order');
    }
    if (setClauses.length === 0) return current;
    setClauses.push('updated_at = SYSUTCDATETIME()');
    await request.query(`UPDATE dbo.parameters SET ${setClauses.join(', ')} WHERE id = @id`);
    return this.getById(id);
  }

  async setActive(id: number, isActive: boolean) {
    const current = await this.getById(id);
    if (!isActive) {
      const usage = await this.countUsage(current.categoryCode, current.code);
      if (usage > 0) {
        throw new BadRequestException(
          `No se puede desactivar: hay ${usage} registro(s) usando este valor actualmente.`,
        );
      }
    }
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('is_active', sql.Bit, isActive)
      .query('UPDATE dbo.parameters SET is_active = @is_active, updated_at = SYSUTCDATETIME() WHERE id = @id');
    return this.getById(id);
  }

  async remove(id: number) {
    const current = await this.getById(id);
    if (current.isSystem) {
      throw new BadRequestException('Este valor es parte del sistema base y no se puede eliminar. Podés desactivarlo.');
    }
    const usage = await this.countUsage(current.categoryCode, current.code);
    if (usage > 0) {
      throw new BadRequestException(`No se puede eliminar: hay ${usage} registro(s) usando este valor actualmente.`);
    }
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.parameters WHERE id = @id');
  }

  private async countUsage(categoryCode: string, code: string): Promise<number> {
    const location = USAGE_LOOKUP[categoryCode];
    if (!location) return 0;
    const result = await this.pool
      .request()
      .input('code', sql.NVarChar, code)
      .query(`SELECT COUNT(*) AS cnt FROM ${location.table} WHERE ${location.column} = @code`);
    return result.recordset[0].cnt;
  }
}
