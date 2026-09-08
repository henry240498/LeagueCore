import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as sql from 'mssql';
import { passwordPolicyError } from '../auth/password-policy';
import { SQL_POOL } from '../database/database.module';
import type { CreateUserDto } from './dto/create-user.dto';
import type { SetUserPasswordDto, SetUserStatusDto, UpdateUserDto } from './dto/update-user.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

// El usuario 'admin' sembrado (id fijo) es la única cuenta con recuperación garantizada -- se
// protege por nombre de usuario, no por id, porque el pedido lo nombra explícitamente ("el usuario
// admin debe protegerse") y username es lo único que no puede cambiar (ver assertNotUsername).
const PROTECTED_USERNAME = 'admin';

function toPublicUser(row: Record<string, any>) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: !!row.is_active,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  private async audit(userId: number, action: string, meta: RequestMeta, entityId?: number, details?: string) {
    await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .input('action', sql.NVarChar, action)
      .input('entity', sql.NVarChar, 'user')
      .input('entity_id', sql.Int, entityId ?? null)
      .input('details', sql.NVarChar, details ?? null)
      .input('ip_address', sql.NVarChar, meta.ip ?? null)
      .query(
        `INSERT INTO dbo.audit_log (user_id, action, entity, entity_id, details, ip_address)
         VALUES (@user_id, @action, @entity, @entity_id, @details, @ip_address)`,
      );
  }

  async list() {
    const result = await this.pool
      .request()
      .query(
        `SELECT id, username, email, display_name, role, is_active, last_login, created_at, updated_at
         FROM dbo.users ORDER BY username`,
      );
    return result.recordset.map(toPublicUser);
  }

  async getById(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT id, username, email, display_name, role, is_active, last_login, created_at, updated_at
         FROM dbo.users WHERE id = @id`,
      );
    if (result.recordset.length === 0) throw new NotFoundException('Usuario no encontrado');
    return toPublicUser(result.recordset[0]);
  }

  private async getUsernameById(id: number): Promise<string | null> {
    const result = await this.pool.request().input('id', sql.Int, id).query('SELECT username FROM dbo.users WHERE id = @id');
    return result.recordset[0]?.username ?? null;
  }

  async create(dto: CreateUserDto, actorId: number, meta: RequestMeta) {
    const policyError = passwordPolicyError(dto.password);
    if (policyError) throw new BadRequestException(policyError);

    const hash = await bcrypt.hash(dto.password, 10);
    const request = this.pool.request();
    request.input('username', sql.NVarChar, dto.username.trim());
    request.input('email', sql.NVarChar, dto.email ?? null);
    request.input('display_name', sql.NVarChar, dto.displayName ?? null);
    request.input('password_hash', sql.NVarChar, hash);
    request.input('role', sql.NVarChar, dto.role);
    request.input('is_active', sql.Bit, dto.isActive ?? true);

    try {
      const result = await request.query(
        `INSERT INTO dbo.users (username, email, display_name, password_hash, role, is_active, password_temp_reset, force_password_change_on_reset)
         OUTPUT INSERTED.id
         VALUES (@username, @email, @display_name, @password_hash, @role, @is_active, 1, 1)`,
      );
      const id = result.recordset[0].id;
      await this.audit(actorId, 'create_user', meta, id, `username: ${dto.username}, role: ${dto.role}`);
      return this.getById(id);
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new ConflictException('Ya existe un usuario con ese nombre de usuario o correo electrónico');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateUserDto, actorId: number, meta: RequestMeta) {
    await this.getById(id);
    if (dto.role) await this.assertNotProtected(id, 'cambiarle el rol');
    if (dto.username) await this.assertNotProtected(id, 'cambiarle el nombre de usuario');

    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.getById(id);

    const columnMap: Record<string, string> = { username: 'username', email: 'email', displayName: 'display_name', role: 'role' };
    const request = this.pool.request();
    const setClauses: string[] = [];
    for (const [camel, value] of entries) {
      const column = columnMap[camel];
      if (!column) continue;
      request.input(column, sql.NVarChar, value);
      setClauses.push(`${column} = @${column}`);
    }
    setClauses.push('updated_at = SYSUTCDATETIME()');
    request.input('id', sql.Int, id);

    try {
      await request.query(`UPDATE dbo.users SET ${setClauses.join(', ')} WHERE id = @id`);
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new ConflictException('Ya existe un usuario con ese nombre de usuario o correo electrónico');
      }
      throw err;
    }
    await this.audit(actorId, 'update_user', meta, id, JSON.stringify(dto));
    return this.getById(id);
  }

  async setStatus(id: number, dto: SetUserStatusDto, actorId: number, meta: RequestMeta) {
    await this.getById(id);
    if (dto.status === 'inactive') {
      await this.assertNotProtected(id, 'desactivar');
      await this.assertNotSelf(id, actorId, 'desactivar tu propia cuenta');
    }
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('is_active', sql.Bit, dto.status === 'active')
      .query(`UPDATE dbo.users SET is_active = @is_active, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    await this.audit(actorId, dto.status === 'active' ? 'activate_user' : 'deactivate_user', meta, id);
    return this.getById(id);
  }

  async adminResetPassword(id: number, actorId: number, meta: RequestMeta) {
    await this.getById(id);
    const hash = await bcrypt.hash('123456', 10);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('hash', sql.NVarChar, hash)
      .query(
        `UPDATE dbo.users SET password_hash = @hash, password_temp_reset = 1, updated_at = SYSUTCDATETIME() WHERE id = @id`,
      );
    await this.audit(actorId, 'admin_reset_password', meta, id);
    return { message: 'Contraseña restablecida a 123456' };
  }

  async adminSetPassword(id: number, dto: SetUserPasswordDto, actorId: number, meta: RequestMeta) {
    await this.getById(id);
    const policyError = passwordPolicyError(dto.password);
    if (policyError) throw new BadRequestException(policyError);

    const hash = await bcrypt.hash(dto.password, 10);
    await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('hash', sql.NVarChar, hash)
      .query(
        `UPDATE dbo.users SET password_hash = @hash, password_temp_reset = 1, updated_at = SYSUTCDATETIME() WHERE id = @id`,
      );
    await this.audit(actorId, 'admin_change_password', meta, id);
    return { message: 'Contraseña actualizada' };
  }

  async remove(id: number, actorId: number, meta: RequestMeta) {
    await this.getById(id);
    await this.assertNotProtected(id, 'eliminar');
    await this.assertNotSelf(id, actorId, 'eliminar tu propia cuenta');

    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.users WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException(
          'No se puede eliminar: el usuario tiene historial asociado (sesiones, auditoría u otras acciones). Desactivalo en su lugar para conservar la trazabilidad.',
        );
      }
      throw err;
    }
    await this.audit(actorId, 'delete_user', meta, id);
  }

  private async assertNotProtected(id: number, actionLabel: string) {
    const username = await this.getUsernameById(id);
    if (username === PROTECTED_USERNAME) {
      throw new ForbiddenException(`No se puede ${actionLabel} al usuario administrador principal (${PROTECTED_USERNAME})`);
    }
  }

  private async assertNotSelf(id: number, actorId: number, actionLabel: string) {
    if (id === actorId) {
      throw new ForbiddenException(`No podés ${actionLabel}`);
    }
  }
}
