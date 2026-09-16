import { OperationsService } from './operations.service';

function createMockPool() {
  const trainings: any[] = [];
  const alerts: any[] = [];
  let nextId = 1;
  const request = () => {
    const inputs: Record<string, any> = {};
    const req: any = {
      input(name: string, ...rest: any[]) {
        inputs[name] = rest.length > 1 ? rest[1] : rest[0];
        return req;
      },
      async query(sqlText: string) {
        const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
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
  return { request, query };
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
});
