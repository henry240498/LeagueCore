import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';

function createMockPool() {
  let rows: any[] = [];
  let nextId = 1;

  const request = () => {
    const inputs: Record<string, any> = {};
    const req: any = {
      input(name: string, ...rest: any[]) {
        // soporta tanto .input('col', value) como .input('col', sql.Type, value)
        inputs[name] = rest.length > 1 ? rest[1] : rest[0];
        return req;
      },
      async query(sqlText: string) {
        const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

        if (q.startsWith('insert into dbo.competitions')) {
          const row: any = { id: nextId++, created_at: new Date(), updated_at: new Date() };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          rows.push(row);
          return { recordset: [row] };
        }
        if (q.startsWith('update dbo.competitions')) {
          const row = rows.find((r) => r.id === inputs.id);
          if (row) {
            for (const [k, v] of Object.entries(inputs)) {
              if (k !== 'id') row[k] = v;
            }
          }
          return { recordset: [] };
        }
        if (q.startsWith('delete from dbo.competitions')) {
          const row = rows.find((r) => r.id === inputs.id);
          if (row?.name === 'CON_EQUIPOS') {
            const err: any = new Error('FK violation');
            err.number = 547;
            throw err;
          }
          rows = rows.filter((r) => r.id !== inputs.id);
          return { recordset: [] };
        }
        if (q.includes('where id = @id')) {
          const row = rows.find((r) => r.id === inputs.id);
          return { recordset: row ? [row] : [] };
        }
        if (q.startsWith('select * from dbo.competitions')) {
          return { recordset: rows };
        }
        return { recordset: [] };
      },
    };
    return req;
  };

  return { request, getRows: () => rows };
}

describe('CompetitionsService', () => {
  it('crea una competición y la devuelve con los campos mapeados', async () => {
    const pool = createMockPool();
    const service = new CompetitionsService(pool as any);

    const created = await service.create({ name: 'Copa Asunción', sport: 'Fútbol' } as any);

    expect(created.id).toBe(1);
    expect(created.name).toBe('Copa Asunción');
  });

  it('lanza NotFoundException al buscar una competición inexistente', async () => {
    const pool = createMockPool();
    const service = new CompetitionsService(pool as any);

    await expect(service.getById(999)).rejects.toThrow(NotFoundException);
  });

  it('actualiza sólo los campos provistos', async () => {
    const pool = createMockPool();
    const service = new CompetitionsService(pool as any);
    const created = await service.create({ name: 'Liga A' } as any);

    const updated = await service.update(created.id, { description: 'Nueva descripción' } as any);

    expect(updated.name).toBe('Liga A');
    expect(updated.description).toBe('Nueva descripción');
  });

  it('cambia el estado con setStatus', async () => {
    const pool = createMockPool();
    const service = new CompetitionsService(pool as any);
    const created = await service.create({ name: 'Liga B' } as any);

    const result = await service.setStatus(created.id, 'inactive');

    expect(result.status).toBe('inactive');
  });

  it('convierte un error de FK (547) al eliminar en un mensaje claro', async () => {
    const pool = createMockPool();
    const service = new CompetitionsService(pool as any);
    const created = await service.create({ name: 'CON_EQUIPOS' } as any);

    await expect(service.remove(created.id)).rejects.toThrow(BadRequestException);
  });
});
