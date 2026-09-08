import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

function toCamel(row: Record<string, any>) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    reportType: row.report_type,
    filters: row.filters ? JSON.parse(row.filters) : {},
    columns: row.columns ? JSON.parse(row.columns) : null,
    sortBy: row.sort_by,
    sortDir: row.sort_dir,
    isFavorite: !!row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SaveReportInput {
  name: string;
  reportType: string;
  filters?: Record<string, unknown>;
  columns?: string[] | null;
  sortBy?: string | null;
  sortDir?: string | null;
}

// §31/§32/§33 del pedido: guardar una configuración de reporte (filtros/columnas/orden) y marcarla
// favorita, para volver a ejecutarla sin reconfigurar. Cada usuario ve y administra sus propios
// reportes guardados; sólo un admin puede ver/borrar los de otros (mapeado sobre el rol existente,
// sin tabla de permisos nueva -- ver roles.guard.ts, mismo criterio que el resto del sistema).
@Injectable()
export class SavedReportsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(userId: number, isAdmin: boolean) {
    const request = this.pool.request();
    let where = 'WHERE sr.user_id = @user_id';
    if (isAdmin) where = '';
    else request.input('user_id', sql.Int, userId);
    const result = await request.query(
      `SELECT sr.*, u.username FROM dbo.saved_reports sr JOIN dbo.users u ON u.id = sr.user_id ${where}
       ORDER BY sr.is_favorite DESC, sr.updated_at DESC, sr.created_at DESC`,
    );
    return result.recordset.map(toCamel);
  }

  async create(userId: number, input: SaveReportInput) {
    const result = await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .input('name', sql.NVarChar, input.name)
      .input('report_type', sql.NVarChar, input.reportType)
      .input('filters', sql.NVarChar, input.filters ? JSON.stringify(input.filters) : null)
      .input('columns', sql.NVarChar, input.columns ? JSON.stringify(input.columns) : null)
      .input('sort_by', sql.NVarChar, input.sortBy ?? null)
      .input('sort_dir', sql.NVarChar, input.sortDir ?? null)
      .query(
        `INSERT INTO dbo.saved_reports (user_id, name, report_type, filters, columns, sort_by, sort_dir)
         OUTPUT INSERTED.id
         VALUES (@user_id, @name, @report_type, @filters, @columns, @sort_by, @sort_dir)`,
      );
    return this.getOwned(result.recordset[0].id, userId, true);
  }

  async remove(id: number, userId: number, isAdmin: boolean) {
    await this.getOwned(id, userId, isAdmin);
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.saved_reports WHERE id = @id');
  }

  async toggleFavorite(id: number, userId: number, isAdmin: boolean) {
    const current = await this.getOwned(id, userId, isAdmin);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('is_favorite', sql.Bit, !current.isFavorite)
      .query('UPDATE dbo.saved_reports SET is_favorite = @is_favorite, updated_at = SYSUTCDATETIME() WHERE id = @id');
    return this.getOwned(id, userId, isAdmin);
  }

  private async getOwned(id: number, userId: number, isAdmin: boolean) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT sr.*, u.username FROM dbo.saved_reports sr JOIN dbo.users u ON u.id = sr.user_id WHERE sr.id = @id`,
      );
    if (result.recordset.length === 0) throw new NotFoundException('Reporte guardado no encontrado');
    const row = toCamel(result.recordset[0]);
    if (!isAdmin && row.userId !== userId) {
      throw new ForbiddenException('No podés administrar un reporte guardado de otro usuario');
    }
    return row;
  }
}
