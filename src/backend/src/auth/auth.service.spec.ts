import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService, UserRow } from './auth.service';

/**
 * Mock mínimo del ConnectionPool de mssql: interpreta la consulta por contenido
 * normalizado (sin importar saltos de línea/espacios) y mantiene un solo usuario
 * en memoria, suficiente para probar la lógica de AuthService.login sin SQL Server real.
 */
function createMockPool(initialUser: Partial<UserRow> | null) {
  let user: any = initialUser ? { ...initialUser } : null;

  const request = () => {
    const inputs: Record<string, any> = {};
    const req: any = {
      input(name: string, _type: any, value: any) {
        inputs[name] = value;
        return req;
      },
      async query(sqlText: string) {
        const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

        if (q.includes('last_login')) {
          user.login_attempts = 0;
          return { recordset: [] };
        }
        if (q.includes('login_attempts = login_attempts + 1')) {
          user.login_attempts += 1;
          return { recordset: [] };
        }
        if (q.includes('where username = @username')) {
          return { recordset: user ? [user] : [] };
        }
        if (q.includes('where id = @id') && q.startsWith('select')) {
          return { recordset: user ? [user] : [] };
        }
        if (q.includes('insert into dbo.sessions')) {
          return { recordset: [] };
        }
        if (q.includes('insert into dbo.audit_log')) {
          return { recordset: [] };
        }
        if (q.includes('from dbo.sessions')) {
          return { recordset: [{}] };
        }
        return { recordset: [] };
      },
    };
    return req;
  };

  return { request, getUser: () => user };
}

const baseUser: Omit<UserRow, 'login_attempts' | 'locked_until'> = {
  id: 1,
  username: 'admin',
  email: null,
  password_hash: '',
  display_name: 'Administrador',
  role: 'admin',
  is_active: true,
  password_temp_reset: true,
  force_password_change_on_reset: true,
};

describe('AuthService.login', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('inicia sesión con credenciales correctas y devuelve token + passwordTempReset', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const pool = createMockPool({
      ...baseUser,
      password_hash: hash,
      login_attempts: 0,
      locked_until: null,
    });
    const service = new AuthService(pool as any);

    const result = await service.login('admin', '123456', {});

    expect(result.token).toBeTruthy();
    expect(result.passwordTempReset).toBe(true);
    expect(result.user.username).toBe('admin');
  });

  it('rechaza contraseña incorrecta e incrementa login_attempts (sólo informativo)', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const pool = createMockPool({
      ...baseUser,
      password_hash: hash,
      login_attempts: 0,
      locked_until: null,
    });
    const service = new AuthService(pool as any);

    await expect(service.login('admin', 'incorrecta', {})).rejects.toThrow(
      UnauthorizedException,
    );
    expect(pool.getUser().login_attempts).toBe(1);
  });

  it('NO bloquea la cuenta sin importar cuántos intentos fallidos seguidos haya (a pedido del usuario, 2026-08-20)', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const pool = createMockPool({
      ...baseUser,
      password_hash: hash,
      login_attempts: 0,
      locked_until: null,
    });
    const service = new AuthService(pool as any);

    for (let i = 0; i < 10; i++) {
      await expect(service.login('admin', 'incorrecta', {})).rejects.toThrow(
        UnauthorizedException,
      );
    }
    expect(pool.getUser().login_attempts).toBe(10);
    expect(pool.getUser().locked_until).toBeNull();

    // la contraseña correcta sigue funcionando después de muchos intentos fallidos
    const result = await service.login('admin', '123456', {});
    expect(result.token).toBeTruthy();
  });

  it('rechaza el login de una cuenta desactivada manualmente (is_active = false), aunque la contraseña sea correcta', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const pool = createMockPool({
      ...baseUser,
      password_hash: hash,
      is_active: false,
      login_attempts: 0,
      locked_until: null,
    });
    const service = new AuthService(pool as any);

    await expect(service.login('admin', '123456', {})).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('no exige cambio de contraseña si force_password_change_on_reset está desactivado, aunque password_temp_reset sea true (caso admin)', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const pool = createMockPool({
      ...baseUser,
      password_hash: hash,
      password_temp_reset: true,
      force_password_change_on_reset: false,
      login_attempts: 0,
      locked_until: null,
    });
    const service = new AuthService(pool as any);

    const result = await service.login('admin', '123456', {});
    expect(result.passwordTempReset).toBe(false);
    expect(result.user.forcePasswordChangeOnReset).toBe(false);
  });

  it('respeta un locked_until fijado manualmente (mecanismo disponible para un futuro bloqueo admin), aunque la contraseña sea correcta', async () => {
    const hash = await bcrypt.hash('123456', 4);
    const pool = createMockPool({
      ...baseUser,
      password_hash: hash,
      login_attempts: 0,
      locked_until: new Date(Date.now() + 10 * 60_000),
    });
    const service = new AuthService(pool as any);

    await expect(service.login('admin', '123456', {})).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
