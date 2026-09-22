import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { passwordPolicyError } from './password-policy';

/**
 * Secreto de firma/verificación de JWT.
 *
 * El valor de desarrollo está publicado en el repositorio, así que usarlo en producción permitiría
 * a cualquiera firmar un token de administrador. Por eso en producción la variable es OBLIGATORIA:
 * si falta, se lanza en vez de caer a un default conocido. En desarrollo se permite el valor local
 * para no romper el arranque de quien clona el repo.
 */
const DEV_JWT_SECRET = 'dev-secret-change-me';

export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET no está definido. Es obligatorio en producción: sin él, los tokens se firmarían ' +
        'con un secreto público y cualquiera podría suplantar a un administrador.',
    );
  }
  return DEV_JWT_SECRET;
}

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  password_temp_reset: boolean;
  login_attempts: number;
  locked_until: Date | null;
  force_password_change_on_reset: boolean;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

function sanitizeUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    forcePasswordChangeOnReset: !!user.force_password_change_on_reset,
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  private async findByUsername(username: string): Promise<UserRow | null> {
    const result = await this.pool
      .request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM dbo.users WHERE username = @username');
    return (result.recordset[0] as UserRow) ?? null;
  }

  private async findById(id: number): Promise<UserRow | null> {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.users WHERE id = @id');
    return (result.recordset[0] as UserRow) ?? null;
  }

  private async audit(
    userId: number | null,
    action: string,
    meta: RequestMeta,
    details?: string,
  ) {
    await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .input('action', sql.NVarChar, action)
      .input('details', sql.NVarChar, details ?? null)
      .input('ip_address', sql.NVarChar, meta.ip ?? null)
      .query(
        `INSERT INTO dbo.audit_log (user_id, action, details, ip_address)
         VALUES (@user_id, @action, @details, @ip_address)`,
      );
  }

  async login(username: string, password: string, meta: RequestMeta) {
    const user = await this.findByUsername(username);

    if (!user || !user.is_active) {
      // is_active = 0 es el bloqueo MANUAL (lo apaga un admin) — no hay bloqueo automático
      // por intentos fallidos, a pedido explícito del usuario (2026-08-20).
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    // locked_until ya no lo fija el sistema solo; queda como mecanismo disponible para un
    // futuro bloqueo manual temporal desde Seguridad, si hiciera falta.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new UnauthorizedException(
        'Usuario bloqueado. Contactá al administrador.',
      );
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      // Se registra el intento fallido (contador + auditoría) sólo como dato informativo —
      // no dispara ningún bloqueo automático.
      await this.pool
        .request()
        .input('id', sql.Int, user.id)
        .query(`UPDATE dbo.users SET login_attempts = login_attempts + 1 WHERE id = @id`);
      await this.audit(user.id, 'login_failed', meta);
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    await this.pool
      .request()
      .input('id', sql.Int, user.id)
      .query(
        `UPDATE dbo.users
         SET login_attempts = 0, last_login = SYSUTCDATETIME()
         WHERE id = @id`,
      );

    const token = this.signToken(user);
    await this.storeSession(user.id, token, meta);
    await this.audit(user.id, 'login', meta);

    return {
      token,
      user: sanitizeUser(user),
      passwordTempReset:
        !!user.password_temp_reset && !!user.force_password_change_on_reset,
    };
  }

  private signToken(user: UserRow): string {
    const secret = resolveJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN ?? '24h';
    return jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        jti: crypto.randomUUID(),
      },
      secret,
      { expiresIn } as jwt.SignOptions,
    );
  }

  private async storeSession(userId: number, token: string, meta: RequestMeta) {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60_000);

    await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .input('token_hash', sql.NVarChar, hashToken(token))
      .input('expires_at', sql.DateTime2, expiresAt)
      .input('ip_address', sql.NVarChar, meta.ip ?? null)
      .input('user_agent', sql.NVarChar, meta.userAgent ?? null)
      .query(
        `INSERT INTO dbo.sessions (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES (@user_id, @token_hash, @expires_at, @ip_address, @user_agent)`,
      );
  }

  async validateSession(token: string): Promise<{ id: number; username: string; role: string } | null> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, resolveJwtSecret()) as jwt.JwtPayload;
    } catch {
      return null;
    }

    const result = await this.pool
      .request()
      .input('token_hash', sql.NVarChar, hashToken(token))
      .query(
        `SELECT TOP 1 1 FROM dbo.sessions
         WHERE token_hash = @token_hash AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME()`,
      );
    if (result.recordset.length === 0) return null;

    return {
      id: Number(payload.sub),
      username: payload.username as string,
      role: payload.role as string,
    };
  }

  async logout(token: string, userId: number, meta: RequestMeta) {
    await this.pool
      .request()
      .input('token_hash', sql.NVarChar, hashToken(token))
      .query(
        `UPDATE dbo.sessions SET revoked_at = SYSUTCDATETIME() WHERE token_hash = @token_hash`,
      );
    await this.audit(userId, 'logout', meta);
  }

  async me(userId: number) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();
    return sanitizeUser(user);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();

    const currentOk = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentOk) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) throw new BadRequestException(policyError);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.pool
      .request()
      .input('id', sql.Int, userId)
      .input('hash', sql.NVarChar, hash)
      .query(
        `UPDATE dbo.users
         SET password_hash = @hash, password_temp_reset = 0, updated_at = SYSUTCDATETIME()
         WHERE id = @id`,
      );
    await this.audit(userId, 'change_password', meta);
  }

  async changePasswordFirstLogin(
    userId: number,
    newPassword: string,
    meta: RequestMeta,
  ) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.password_temp_reset) {
      throw new BadRequestException(
        'Esta cuenta no tiene un cambio de contraseña pendiente',
      );
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) throw new BadRequestException(policyError);

    const hash = await bcrypt.hash(newPassword, 10);
    await this.pool
      .request()
      .input('id', sql.Int, userId)
      .input('hash', sql.NVarChar, hash)
      .query(
        `UPDATE dbo.users
         SET password_hash = @hash, password_temp_reset = 0, updated_at = SYSUTCDATETIME()
         WHERE id = @id`,
      );
    await this.audit(userId, 'change_password_first_login', meta);
  }

  async listSessions(userId: number, currentToken: string) {
    const currentHash = hashToken(currentToken);
    const result = await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .query(
        `SELECT id, token_hash, created_at, expires_at, ip_address, user_agent
         FROM dbo.sessions
         WHERE user_id = @user_id AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME()
         ORDER BY created_at DESC`,
      );

    return result.recordset.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isCurrent: row.token_hash === currentHash,
    }));
  }

  async revokeSession(userId: number, sessionId: number, meta: RequestMeta) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, sessionId)
      .input('user_id', sql.Int, userId)
      .query(
        `UPDATE dbo.sessions SET revoked_at = SYSUTCDATETIME()
         WHERE id = @id AND user_id = @user_id AND revoked_at IS NULL`,
      );
    if (result.rowsAffected[0] === 0) {
      throw new NotFoundException('Sesión no encontrada');
    }
    await this.audit(userId, 'revoke_session', meta, `session_id: ${sessionId}`);
  }

  async revokeOtherSessions(userId: number, currentToken: string, meta: RequestMeta) {
    const currentHash = hashToken(currentToken);
    const result = await this.pool
      .request()
      .input('user_id', sql.Int, userId)
      .input('current_hash', sql.NVarChar, currentHash)
      .query(
        `UPDATE dbo.sessions SET revoked_at = SYSUTCDATETIME()
         WHERE user_id = @user_id AND token_hash <> @current_hash AND revoked_at IS NULL`,
      );
    await this.audit(userId, 'revoke_other_sessions', meta);
    return { revoked: result.rowsAffected[0] };
  }

  async resetOwnPassword(userId: number, meta: RequestMeta) {
    const hash = await bcrypt.hash('123456', 10);
    await this.pool
      .request()
      .input('id', sql.Int, userId)
      .input('hash', sql.NVarChar, hash)
      .query(
        `UPDATE dbo.users
         SET password_hash = @hash, password_temp_reset = 1, updated_at = SYSUTCDATETIME()
         WHERE id = @id`,
      );
    await this.audit(userId, 'reset_password', meta);
  }

  async setForcePasswordChangeOnReset(
    userId: number,
    value: boolean,
    meta: RequestMeta,
  ) {
    await this.pool
      .request()
      .input('id', sql.Int, userId)
      .input('value', sql.Bit, value)
      .query(
        `UPDATE dbo.users
         SET force_password_change_on_reset = @value, updated_at = SYSUTCDATETIME()
         WHERE id = @id`,
      );
    await this.audit(
      userId,
      'update_preferences',
      meta,
      `force_password_change_on_reset: ${value}`,
    );
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException();
    return sanitizeUser(user);
  }
}
