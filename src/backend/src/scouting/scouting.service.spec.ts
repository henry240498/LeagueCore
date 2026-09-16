import { BadRequestException } from '@nestjs/common';
import { ScoutingService } from './scouting.service';

function createMockPool() {
  const watchlist: any[] = [];
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
        if (q.startsWith('insert into dbo.watchlist')) {
          const row: any = { id: nextId++ };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          watchlist.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.startsWith('select w.*, p.full_name')) {
          return { recordset: watchlist };
        }
        if (q.startsWith('insert into dbo.scouting_reports') && !inputs.player_id && !inputs.external_name) {
          return { recordset: [] };
        }
        return { recordset: [] };
      },
    };
    return req;
  };
  return { request };
}

describe('ScoutingService', () => {
  it('agrega a watchlist con jugador registrado', async () => {
    const service = new ScoutingService(createMockPool() as any);
    const created = await service.addWatchItem({ playerId: 5, priority: 'ALTA' } as any);
    expect(created.id).toBe(1);
  });

  it('rechaza watchlist sin jugador ni nombre externo', async () => {
    const service = new ScoutingService(createMockPool() as any);
    await expect(service.addWatchItem({ priority: 'ALTA' } as any)).rejects.toThrow(BadRequestException);
  });

  it('rechaza informe de scouting sin sujeto', async () => {
    const service = new ScoutingService(createMockPool() as any);
    await expect(service.createScoutingReport({ position: 'Delantero' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza comparar menos de 2 jugadores', async () => {
    const service = new ScoutingService(createMockPool() as any);
    await expect(service.comparePlayers([1])).rejects.toThrow(BadRequestException);
  });
});
