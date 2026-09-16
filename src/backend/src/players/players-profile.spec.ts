import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlayersService } from './players.service';

function createMockPool(existingPlayerIds: number[] = [1]) {
  const physical: any[] = [];
  const technical: any[] = [];
  const injuries: any[] = [];
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

        if (q === 'select top 1 1 from dbo.players where id = @id') {
          return { recordset: existingPlayerIds.includes(inputs.id) ? [{}] : [] };
        }
        if (q.startsWith('select p.*, t.name as team_name') && q.includes('where p.id = @id')) {
          const found = existingPlayerIds.includes(inputs.id);
          return {
            recordset: found
              ? [
                  {
                    id: inputs.id,
                    first_name: 'Juan',
                    last_name: 'Pérez',
                    full_name: 'Juan Pérez',
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                ]
              : [],
          };
        }
        if (q.includes('from dbo.player_team_history')) {
          return { recordset: [] };
        }
        if (q.startsWith('select top (@limit_n) * from dbo.player_physical_records')) {
          return {
            recordset: physical
              .filter((r) => r.player_id === inputs.player_id)
              .sort((a, b) => b.id - a.id)
              .slice(0, inputs.limit_n),
          };
        }
        if (q.startsWith('insert into dbo.player_physical_records')) {
          const row: any = { id: nextId++, created_at: new Date() };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          physical.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.startsWith('select * from dbo.player_physical_records where id = @id')) {
          return { recordset: physical.filter((r) => r.id === inputs.id) };
        }
        if (q.includes('from dbo.player_technical_ratings')) {
          return { recordset: technical.filter((r) => r.player_id === inputs.player_id) };
        }
        if (q.startsWith('merge dbo.player_technical_ratings')) {
          const idx = technical.findIndex(
            (r) =>
              r.player_id === inputs.player_id &&
              r.attribute === inputs.attribute &&
              String(r.evaluated_at) === String(inputs.evaluated_at),
          );
          const row = {
            id: idx >= 0 ? technical[idx].id : nextId++,
            player_id: inputs.player_id,
            attribute: inputs.attribute,
            value: inputs.value,
            evaluated_at: inputs.evaluated_at,
            evaluator: inputs.evaluator,
          };
          if (idx >= 0) technical[idx] = row;
          else technical.push(row);
          return { recordset: [] };
        }
        if (q.startsWith('select * from dbo.player_injuries where player_id')) {
          return { recordset: injuries.filter((r) => r.player_id === inputs.player_id) };
        }
        if (q.startsWith('insert into dbo.player_injuries')) {
          const row: any = { id: nextId++, status: 'ACTIVA', created_at: new Date(), updated_at: new Date() };
          for (const [k, v] of Object.entries(inputs)) row[k] = v;
          injuries.push(row);
          return { recordset: [{ id: row.id }] };
        }
        if (q.startsWith('select * from dbo.player_injuries where id = @id')) {
          return { recordset: injuries.filter((r) => r.id === inputs.id) };
        }
        return { recordset: [] };
      },
    };
    return req;
  };

  return { request };
}

describe('PlayersService - expediente (Fase 2)', () => {
  it('registra un snapshot fisico con GPS y lo devuelve en camelCase', async () => {
    const service = new PlayersService(createMockPool() as any);
    const created = await service.addPhysical(1, {
      maxSpeedKmh: 32,
      distanceM: 10500,
      sprints: 24,
      playerLoad: 890,
      acwr: 1.2,
      source: 'gps',
    } as any);

    expect(created.maxSpeedKmh).toBe(32);
    expect(created.source).toBe('gps');
  });

  it('rechaza guardar tecnica sin valoraciones', async () => {
    const service = new PlayersService(createMockPool() as any);
    await expect(service.saveTechnical(1, { ratings: [] } as any)).rejects.toThrow(BadRequestException);
  });

  it('rechaza valores fuera de 1-100', async () => {
    const service = new PlayersService(createMockPool() as any);
    await expect(
      service.saveTechnical(1, { ratings: [{ attribute: 'VELOCIDAD', value: 150 }] } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('guarda y lee valoraciones tecnicas (radar)', async () => {
    const service = new PlayersService(createMockPool() as any);
    await service.saveTechnical(
      1,
      {
        ratings: [
          { attribute: 'VELOCIDAD', value: 87 },
          { attribute: 'VISION', value: 94 },
        ],
        evaluatedAt: '2026-09-01',
      } as any,
    );
    const ratings = await service.getTechnical(1);
    expect(ratings).toHaveLength(2);
    expect(ratings.find((r) => r.attribute === 'VISION')?.value).toBe(94);
  });

  it('arma el perfil agregado con lesion activa', async () => {
    const pool = createMockPool();
    const service = new PlayersService(pool as any);
    await service.addInjury(1, { injuryType: 'Desgarro', severity: 'MODERADA', startDate: '2026-08-01' } as any);

    const profile = await service.getProfile(1);
    expect(profile.player.fullName).toBe('Juan Pérez');
    expect(profile.activeInjury?.injuryType).toBe('Desgarro');
    expect(profile.injuriesCount).toBe(1);
  });

  it('falla con jugador inexistente', async () => {
    const service = new PlayersService(createMockPool([]) as any);
    await expect(service.listPhysical(999)).rejects.toThrow(NotFoundException);
  });
});
