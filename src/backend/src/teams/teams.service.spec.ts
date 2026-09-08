import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';

function createMockPool(competitionIds: number[] = [1]) {
  let rows: any[] = [];
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

        if (q.includes('select top 1 1 from dbo.competitions')) {
          return { recordset: competitionIds.includes(inputs.id) ? [{}] : [] };
        }
        if (q.startsWith('insert into dbo.teams')) {
          const row: any = { id: nextId++, created_at: new Date(), updated_at: new Date() };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          rows.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.startsWith('update dbo.teams')) {
          const row = rows.find((r) => r.id === inputs.id);
          if (row) {
            for (const [k, v] of Object.entries(inputs)) {
              if (k !== 'id') row[k] = v;
            }
          }
          return { recordset: [] };
        }
        if (q.startsWith('delete from dbo.teams')) {
          const row = rows.find((r) => r.id === inputs.id);
          if (row?.name === 'CON_JUGADORES') {
            const err: any = new Error('FK violation');
            err.number = 547;
            throw err;
          }
          rows = rows.filter((r) => r.id !== inputs.id);
          return { recordset: [] };
        }
        if (q.includes('where t.id = @id')) {
          const row = rows.find((r) => r.id === inputs.id);
          return { recordset: row ? [{ ...row, competition_name: 'Competición de prueba' }] : [] };
        }
        if (q.startsWith('select t.*')) {
          return {
            recordset: rows.map((r) => ({ ...r, competition_name: 'Competición de prueba' })),
          };
        }
        return { recordset: [] };
      },
    };
    return req;
  };

  return { request };
}

describe('TeamsService', () => {
  it('crea un equipo cuando la competición existe', async () => {
    const pool = createMockPool([1]);
    const service = new TeamsService(pool as any);

    const created = await service.create({ competitionId: 1, name: 'Cerro Porteño' } as any);

    expect(created.id).toBe(1);
    expect(created.name).toBe('Cerro Porteño');
    expect(created.competitionName).toBe('Competición de prueba');
  });

  it('crea un equipo SIN ninguna competición -- un club es una entidad independiente', async () => {
    const pool = createMockPool([1]);
    const service = new TeamsService(pool as any);

    const created = await service.create({ name: 'Olimpia' } as any);

    expect(created.id).toBe(1);
    expect(created.name).toBe('Olimpia');
  });

  it('rechaza crear un equipo si la competición no existe', async () => {
    const pool = createMockPool([1]);
    const service = new TeamsService(pool as any);

    await expect(
      service.create({ competitionId: 999, name: 'Equipo Fantasma' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza NotFoundException para un equipo inexistente', async () => {
    const pool = createMockPool([1]);
    const service = new TeamsService(pool as any);

    await expect(service.getById(999)).rejects.toThrow(NotFoundException);
  });

  it('convierte un error de FK (547) al eliminar en un mensaje claro', async () => {
    const pool = createMockPool([1]);
    const service = new TeamsService(pool as any);
    const created = await service.create({ competitionId: 1, name: 'CON_JUGADORES' } as any);

    await expect(service.remove(created.id)).rejects.toThrow(BadRequestException);
  });
});
