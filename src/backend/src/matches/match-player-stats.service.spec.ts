import { BadRequestException } from '@nestjs/common';
import { MatchStatsService } from './match-stats.service';

/**
 * Pool mockeado que registra la última consulta ejecutada, para poder verificar el MERGE sin
 * SQL Server real.
 */
function mockPool(opts: { lineupTeamId?: number | null } = {}) {
  const queries: string[] = [];
  const inputs: Record<string, any> = {};
  const pool = {
    request: () => {
      const req: any = {
        input(name: string, _type: any, value?: any) {
          inputs[name] = value !== undefined ? value : _type;
          return req;
        },
        async query(text: string) {
          queries.push(text);
          if (/FROM dbo\.match_lineups/.test(text)) {
            return opts.lineupTeamId == null ? { recordset: [] } : { recordset: [{ team_id: opts.lineupTeamId }] };
          }
          if (/FROM dbo\.match_player_stats s/.test(text)) {
            return { recordset: [{ player_id: 7, team_id: 5, full_name: 'Juan Pérez', shots: 3, recoveries: null }] };
          }
          return { recordset: [] };
        },
      };
      return req;
    },
  } as any;
  return { pool, queries, inputs };
}

describe('MatchStatsService.setForPlayer', () => {
  it('rechaza si el jugador no está en la alineación (no adivina el equipo)', async () => {
    const { pool } = mockPool({ lineupTeamId: null });
    const service = new MatchStatsService(pool);
    await expect(service.setForPlayer(10, 7, { shots: 3 })).rejects.toThrow(BadRequestException);
  });

  it('deriva el equipo de la alineación real del partido', async () => {
    const { pool, inputs } = mockPool({ lineupTeamId: 5 });
    const service = new MatchStatsService(pool);
    await service.setForPlayer(10, 7, { shots: 3 });
    // El equipo NO se recibe del cliente: sale de dbo.match_lineups.
    expect(inputs.team_id).toBe(5);
  });

  it('hace upsert con MERGE (no duplica la fila del jugador)', async () => {
    const { pool, queries } = mockPool({ lineupTeamId: 5 });
    const service = new MatchStatsService(pool);
    await service.setForPlayer(10, 7, { shots: 3 });
    const merge = queries.find((q) => /MERGE dbo\.match_player_stats/.test(q));
    expect(merge).toBeTruthy();
    expect(merge).toMatch(/WHEN MATCHED THEN UPDATE/);
    expect(merge).toMatch(/WHEN NOT MATCHED THEN INSERT/);
  });

  it('un campo en null se guarda como null: "sin datos" no es cero', async () => {
    const { pool, inputs } = mockPool({ lineupTeamId: 5 });
    const service = new MatchStatsService(pool);
    await service.setForPlayer(10, 7, { shots: 3, recoveries: null });
    expect(inputs.shots).toBe(3);
    expect(inputs.recoveries).toBeNull();
  });

  it('ignora los campos no enviados (undefined) en vez de pisarlos', async () => {
    const { pool, queries } = mockPool({ lineupTeamId: 5 });
    const service = new MatchStatsService(pool);
    await service.setForPlayer(10, 7, { shots: 3 });
    const merge = queries.find((q) => /MERGE dbo\.match_player_stats/.test(q))!;
    // Sólo se actualiza lo enviado; una columna no enviada no aparece en el SET.
    expect(merge).toMatch(/shots = @shots/);
    expect(merge).not.toMatch(/clearances = @clearances/);
  });
});
