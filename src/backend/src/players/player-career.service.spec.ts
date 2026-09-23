import { NotFoundException } from '@nestjs/common';
import { PlayerCareerService } from './player-career.service';

/**
 * Pool mockeado: decide qué recordset devolver según el contenido de la consulta.
 * Alcanza para probar el mapeo y las reglas de "sin datos", sin SQL Server real.
 */
function mockPool(recordsets: { match: RegExp; rows: any[] }[]) {
  return {
    request: () => {
      const req: any = {
        input: () => req,
        async query(text: string) {
          const hit = recordsets.find((r) => r.match.test(text));
          return { recordset: hit ? hit.rows : [] };
        },
      };
      return req;
    },
  } as any;
}

const PLAYER_EXISTS = { match: /FROM dbo\.players WHERE id/, rows: [{ id: 7 }] };

describe('PlayerCareerService', () => {
  it('lanza 404 si el jugador no existe', async () => {
    const service = new PlayerCareerService(mockPool([]));
    await expect(service.getCareer(99)).rejects.toThrow(NotFoundException);
  });

  it('marca como equipo actual el paso sin fecha de fin', async () => {
    const service = new PlayerCareerService(
      mockPool([
        PLAYER_EXISTS,
        {
          match: /FROM dbo\.player_team_history/,
          rows: [
            { id: 1, team_id: 5, team_name: 'Olimpia', logo_url: null, start_date: '2026-01-01', end_date: null, squad_number: 9, note: null },
            { id: 2, team_id: 6, team_name: 'Cerro', logo_url: null, start_date: '2024-01-01', end_date: '2025-12-31', squad_number: 7, note: null },
          ],
        },
      ]),
    );

    const career = await service.getCareer(7);
    expect(career.teamHistory[0].current).toBe(true);
    expect(career.teamHistory[0].teamName).toBe('Olimpia');
    expect(career.teamHistory[1].current).toBe(false);
  });

  it('devuelve statTotals null cuando la fuente nunca cargó estadísticas individuales', async () => {
    const service = new PlayerCareerService(
      mockPool([PLAYER_EXISTS, { match: /FROM dbo\.match_player_stats/, rows: [{ records: 0 }] }]),
    );
    const career = await service.getCareer(7);
    // null (no "todo en cero"): la interfaz debe poder decir "sin datos".
    expect(career.statTotals).toBeNull();
  });

  it('expone las estadísticas individuales cuando sí existen', async () => {
    const service = new PlayerCareerService(
      mockPool([
        PLAYER_EXISTS,
        {
          match: /FROM dbo\.match_player_stats/,
          rows: [{ records: 3, shots: 12, shots_on_target: 5, passes: 140, passes_completed: 119, recoveries: 9 }],
        },
      ]),
    );
    const career = await service.getCareer(7);
    expect(career.statTotals).not.toBeNull();
    expect(career.statTotals!.matchesWithStats).toBe(3);
    expect(career.statTotals!.shots).toBe(12);
    expect(career.statTotals!.recoveries).toBe(9);
  });

  it('calcula apariciones como suplente a partir de partidos y titularidades', async () => {
    const service = new PlayerCareerService(
      mockPool([
        PLAYER_EXISTS,
        {
          match: /AS matches,/,
          rows: [{ matches: 30, starts: 22, minutes: 1980, goals: 8, own_goals: 1, assists: 5, yellow_cards: 4, red_cards: 1 }],
        },
      ]),
    );
    const career = await service.getCareer(7);
    expect(career.totals.matches).toBe(30);
    expect(career.totals.starts).toBe(22);
    expect(career.totals.substituteAppearances).toBe(8);
    expect(career.totals.goals).toBe(8);
    expect(career.totals.ownGoals).toBe(1);
  });

  it('pagina el historial partido a partido y acota el tamaño de página', async () => {
    const service = new PlayerCareerService(
      mockPool([
        PLAYER_EXISTS,
        { match: /COUNT\(\*\) AS total FROM dbo\.match_lineups/, rows: [{ total: 57 }] },
        { match: /FROM dbo\.match_lineups l/, rows: [] },
      ]),
    );
    const log = await service.getMatchLog(7, { page: 2, pageSize: 999 });
    expect(log.total).toBe(57);
    expect(log.page).toBe(2);
    expect(log.pageSize).toBe(100); // se acota a 100
  });
});
