import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OperationsService } from './operations.service';

function createMockPool() {
  const trainings: any[] = [];
  const alerts: any[] = [];
  const queries: string[] = []; // SQL ejecutado, para verificar la forma de las consultas
  let nextId = 1;
  const request = () => {
    const inputs: Record<string, any> = {};
    const req: any = {
      input(name: string, ...rest: any[]) {
        inputs[name] = rest.length > 1 ? rest[1] : rest[0];
        return req;
      },
      async query(sqlText: string) {
        queries.push(sqlText);
        const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
        if (q.startsWith('update dbo.alerts set status')) {
          const row = alerts.find((a) => a.id === inputs.id);
          if (row) row.status = inputs.status;
          return { recordset: [], rowsAffected: [row ? 1 : 0] };
        }
        if (q === 'select top 1 1 from dbo.teams where id = @id') {
          return { recordset: inputs.id === 1 ? [{}] : [] };
        }
        if (q.startsWith('insert into dbo.trainings')) {
          const row: any = { id: nextId++ };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          trainings.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.includes('from dbo.trainings t join dbo.teams')) {
          return { recordset: trainings.map((t) => ({ ...t, team_name: 'Olimpia', attendance_count: 0 })) };
        }
        if (q.startsWith('select * from dbo.alerts')) {
          return { recordset: alerts };
        }
        if (q.includes("from dbo.alerts where kind = @kind")) {
          return { recordset: [] };
        }
        if (q.startsWith('insert into dbo.alerts')) {
          alerts.push({ id: nextId++, message: inputs.message });
          return { recordset: [] };
        }
        if (q.includes('from dbo.player_injuries')) return { recordset: [] };
        if (q.includes("contract_status = 'por_vencer'")) return { recordset: [] };
        if (q.includes('group by p.id')) return { recordset: [] };
        if (q.includes('from dbo.watchlist')) return { recordset: [] };
        if (q.includes('from dbo.matches m')) return { recordset: [] };
        return { recordset: [] };
      },
    };
    return req;
  };
  const query = async (sqlText: string) => request().query(sqlText);
  return { request, query, queries, alerts };
}

describe('OperationsService', () => {
  it('crea una sesión de entrenamiento', async () => {
    const service = new OperationsService(createMockPool() as any);
    const created = await service.createTraining({ teamId: 1, trainingDate: '2026-09-14', objective: 'Presión' } as any);
    expect(created.id).toBe(1);
  });

  it('lista sesiones con equipo', async () => {
    const pool = createMockPool();
    const service = new OperationsService(pool as any);
    await service.createTraining({ teamId: 1, trainingDate: '2026-09-14' } as any);
    const list = await service.listTrainings(1);
    expect(list).toHaveLength(1);
    expect(list[0].teamName).toBe('Olimpia');
  });

  it('el check de alertas no duplica pendientes', async () => {
    const service = new OperationsService(createMockPool() as any);
    const first = await service.runAlertCheck();
    expect(first.created).toBe(0);
  });

  // Regresión: POST /operations/alerts/check daba 500 ("Ambiguous column name 'id'") porque la consulta de
  // seguimientos vencidos hacía SELECT id sobre watchlist JOIN players, y ambas tablas tienen id.
  // El mock no ejecuta SQL real, así que se verifica la forma de la consulta.
  it('la consulta de seguimientos vencidos califica las columnas (w.id) para no ser ambigua', async () => {
    const pool = createMockPool();
    await new OperationsService(pool as any).runAlertCheck();
    const overdue = pool.queries.find((q) => /from dbo\.watchlist/i.test(q));
    expect(overdue).toBeDefined();
    expect(overdue).toMatch(/select\s+w\.id/i);
    expect(overdue).not.toMatch(/select\s+id\b/i);
  });

  describe('resolveAlert', () => {
    it('marca una alerta existente', async () => {
      const pool = createMockPool();
      pool.alerts.push({ id: 5, status: 'PENDIENTE' });
      const out = await new OperationsService(pool as any).resolveAlert(5, 'RESUELTA');
      expect(out).toEqual({ id: 5 });
      expect(pool.alerts[0].status).toBe('RESUELTA');
    });

    it('rechaza un estado inválido con 400 (antes rompía la restricción de la tabla: 500)', async () => {
      const service = new OperationsService(createMockPool() as any);
      await expect(service.resolveAlert(5, 'XX' as any)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.resolveAlert(5, 'PENDIENTE' as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('responde 404 si la alerta no existe (antes devolvía 200 sin hacer nada)', async () => {
      const service = new OperationsService(createMockPool() as any);
      await expect(service.resolveAlert(999999, 'LEIDA')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
