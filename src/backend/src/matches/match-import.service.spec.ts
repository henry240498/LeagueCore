import { BadRequestException } from '@nestjs/common';
import { MatchImportService } from './match-import.service';

/** Pool mockeado que registra las consultas ejecutadas y los valores parametrizados. */
function mockPool(lineup: { player_id: number; team_id: number }[], opts: { matchExists?: boolean } = {}) {
  const queries: string[] = [];
  const inputs: Record<string, any>[] = [];
  const pool = {
    request: () => {
      const own: Record<string, any> = {};
      inputs.push(own);
      const req: any = {
        input(name: string, _type: any, value?: any) {
          own[name] = value !== undefined ? value : _type;
          return req;
        },
        async query(text: string) {
          queries.push(text);
          if (/FROM dbo\.matches WHERE id/.test(text)) {
            return { recordset: opts.matchExists === false ? [] : [{ 1: 1 }] };
          }
          if (/FROM dbo\.match_lineups WHERE match_id/.test(text)) return { recordset: lineup };
          return { recordset: [] };
        },
      };
      return req;
    },
  } as any;
  return { pool, queries, inputs };
}

const LINEUP = [
  { player_id: 7, team_id: 5 },
  { player_id: 8, team_id: 5 },
];

describe('MatchImportService', () => {
  it('rechaza el lote completo si algún jugador no jugó el partido', async () => {
    const { pool } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    await expect(
      service.importPlayerPositions(10, {
        rows: [
          { playerId: 7, posX: 50, posY: 50 },
          { playerId: 99, posX: 10, posY: 10 }, // no está en la alineación
        ],
      }),
    ).rejects.toThrow(/99/);
  });

  it('deriva el equipo de la alineación, no del cliente', async () => {
    const { pool, inputs } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    await service.importPlayerPositions(10, { rows: [{ playerId: 7, posX: 50, posY: 60 }] });
    // La tercera columna del INSERT es team_id: debe ser 5 (el equipo real del jugador 7).
    const insertInputs = inputs.find((i) => i.p0_2 !== undefined);
    expect(insertInputs?.p0_2).toBe(5);
  });

  it('reemplaza las posiciones del partido: reimportar corrige, no duplica', async () => {
    const { pool, queries } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    await service.importPlayerPositions(10, { rows: [{ playerId: 7, posX: 50, posY: 60 }] });
    expect(queries.some((q) => /DELETE FROM dbo\.match_player_positions/.test(q))).toBe(true);
    expect(queries.some((q) => /INSERT INTO dbo\.match_player_positions/.test(q))).toBe(true);
  });

  it('exige que cada métrica avanzada apunte a un jugador o a un equipo', async () => {
    const { pool } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    await expect(
      service.importAdvancedMetrics(10, { rows: [{ metricName: 'xg', metricValue: 1.2 }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('importa métricas por equipo sin exigir jugador', async () => {
    const { pool } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    const res = await service.importAdvancedMetrics(10, {
      rows: [{ teamId: 5, metricName: 'ppda', metricValue: 8.4, provider: 'proveedor' }],
    });
    expect(res.imported).toBe(1);
    expect(res.replaced).toBe(true);
  });

  it('los datos físicos hacen upsert y NO borran lo anterior', async () => {
    const { pool, queries } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    const res = await service.importPlayerPhysical(10, { rows: [{ playerId: 7, distanceKm: 10.5 }] });
    expect(queries.some((q) => /MERGE dbo\.match_player_physical_stats/.test(q))).toBe(true);
    expect(queries.some((q) => /DELETE FROM dbo\.match_player_physical_stats/.test(q))).toBe(false);
    expect(res.replaced).toBe(false);
  });

  it('rechaza si el partido no existe', async () => {
    const { pool } = mockPool(LINEUP, { matchExists: false });
    const service = new MatchImportService(pool);
    await expect(
      service.importPlayerPositions(999, { rows: [{ playerId: 7, posX: 1, posY: 1 }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('inserta en lotes cuando hay muchas filas (no arma una sola sentencia gigante)', async () => {
    const { pool, queries } = mockPool(LINEUP);
    const service = new MatchImportService(pool);
    const rows = Array.from({ length: 450 }, () => ({ playerId: 7, posX: 50, posY: 50 }));
    const res = await service.importPlayerPositions(10, { rows });
    expect(res.imported).toBe(450);
    const inserts = queries.filter((q) => /INSERT INTO dbo\.match_player_positions/.test(q));
    expect(inserts.length).toBe(3); // 200 + 200 + 50
  });
});
