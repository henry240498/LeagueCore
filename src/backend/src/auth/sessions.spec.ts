import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

type SessionRow = {
  id: number;
  user_id: number;
  token_hash: string;
  revoked_at: Date | null;
  expires_at: Date;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
};

/**
 * Mock del pool enfocado en dbo.sessions: mantiene un array mutable de sesiones
 * y despacha por contenido de la query, suficiente para probar listar/revocar
 * sin SQL Server real.
 */
function createSessionsMockPool(sessions: SessionRow[]) {
  const request = () => {
    const inputs: Record<string, any> = {};
    const req: any = {
      input(name: string, _type: any, value: any) {
        inputs[name] = value;
        return req;
      },
      async query(sqlText: string) {
        const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

        if (q.startsWith('select') && q.includes('from dbo.sessions')) {
          const now = new Date();
          const rows = sessions.filter(
            (s) => s.user_id === inputs.user_id && !s.revoked_at && s.expires_at > now,
          );
          return { recordset: rows, rowsAffected: [rows.length] };
        }

        if (q.includes('update dbo.sessions') && q.includes('where id = @id')) {
          const row = sessions.find(
            (s) => s.id === inputs.id && s.user_id === inputs.user_id && !s.revoked_at,
          );
          if (row) row.revoked_at = new Date();
          return { recordset: [], rowsAffected: [row ? 1 : 0] };
        }

        if (q.includes('update dbo.sessions') && q.includes('token_hash <> @current_hash')) {
          let count = 0;
          for (const s of sessions) {
            if (s.user_id === inputs.user_id && s.token_hash !== inputs.current_hash && !s.revoked_at) {
              s.revoked_at = new Date();
              count += 1;
            }
          }
          return { recordset: [], rowsAffected: [count] };
        }

        if (q.includes('insert into dbo.audit_log')) {
          return { recordset: [], rowsAffected: [1] };
        }

        return { recordset: [], rowsAffected: [0] };
      },
    };
    return req;
  };

  return { request, sessions };
}

function makeSession(overrides: Partial<SessionRow>): SessionRow {
  return {
    id: 1,
    user_id: 1,
    token_hash: 'hash-a',
    revoked_at: null,
    expires_at: new Date(Date.now() + 60 * 60_000),
    created_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla/5.0',
    ...overrides,
  };
}

describe('AuthService — sesiones', () => {
  it('lista sólo las sesiones activas del usuario y marca la sesión actual', async () => {
    const sessions = [
      makeSession({ id: 1, user_id: 1, token_hash: require('crypto').createHash('sha256').update('token-actual').digest('hex') }),
      makeSession({ id: 2, user_id: 1, token_hash: 'otro-hash' }),
      makeSession({ id: 3, user_id: 2, token_hash: 'de-otro-usuario' }), // no debe aparecer
      makeSession({ id: 4, user_id: 1, revoked_at: new Date() }), // revocada, no debe aparecer
    ];
    const pool = createSessionsMockPool(sessions);
    const service = new AuthService(pool as any);

    const result = await service.listSessions(1, 'token-actual');

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.id === 1)?.isCurrent).toBe(true);
    expect(result.find((s) => s.id === 2)?.isCurrent).toBe(false);
    expect(result.some((s) => s.id === 3)).toBe(false);
    expect(result.some((s) => s.id === 4)).toBe(false);
  });

  it('revoca una sesión propia', async () => {
    const sessions = [makeSession({ id: 1, user_id: 1 })];
    const pool = createSessionsMockPool(sessions);
    const service = new AuthService(pool as any);

    await service.revokeSession(1, 1, {});

    expect(sessions[0].revoked_at).not.toBeNull();
  });

  it('no permite revocar una sesión de otro usuario', async () => {
    const sessions = [makeSession({ id: 1, user_id: 2 })];
    const pool = createSessionsMockPool(sessions);
    const service = new AuthService(pool as any);

    await expect(service.revokeSession(1, 1, {})).rejects.toThrow(NotFoundException);
    expect(sessions[0].revoked_at).toBeNull();
  });

  it('revoca todas las sesiones menos la actual', async () => {
    const currentHash = require('crypto').createHash('sha256').update('token-actual').digest('hex');
    const sessions = [
      makeSession({ id: 1, user_id: 1, token_hash: currentHash }),
      makeSession({ id: 2, user_id: 1, token_hash: 'otra-a' }),
      makeSession({ id: 3, user_id: 1, token_hash: 'otra-b' }),
    ];
    const pool = createSessionsMockPool(sessions);
    const service = new AuthService(pool as any);

    const result = await service.revokeOtherSessions(1, 'token-actual', {});

    expect(result.revoked).toBe(2);
    expect(sessions[0].revoked_at).toBeNull();
    expect(sessions[1].revoked_at).not.toBeNull();
    expect(sessions[2].revoked_at).not.toBeNull();
  });
});
