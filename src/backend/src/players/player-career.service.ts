import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

/**
 * Planilla / trayectoria del jugador.
 *
 * Reúne lo que el jugador REALMENTE hizo, a partir de datos ya existentes en la base:
 *  - `player_team_history`  -> los equipos por los que pasó (con fechas y dorsal).
 *  - `match_lineups`        -> en qué partidos estuvo, titular o suplente, minutos y posición.
 *  - `goals` / `cards`      -> goles, asistencias y tarjetas SIEMPRE derivados de los eventos
 *                              reales (mismo criterio que usa la alineación del partido; no se
 *                              guardan totales que puedan quedar desincronizados).
 *  - `match_player_stats`   -> estadísticas individuales por partido (tiros, pases, duelos,
 *                              recuperaciones, etc.) cuando la fuente las cargó.
 *
 * Nada se inventa: si una sección no tiene filas, se devuelve vacía o null y la interfaz lo dice.
 */

// Tarjetas que dejan al jugador fuera: roja directa y doble amarilla (mismo criterio que el partido).
const RED_CARD_TYPES = `('red','second_yellow')`;

export interface PlayerMatchLogQuery {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PlayerCareerService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  private async assertPlayerExists(playerId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, playerId)
      .query('SELECT id FROM dbo.players WHERE id = @id');
    if (result.recordset.length === 0) {
      throw new NotFoundException('Jugador no encontrado');
    }
  }

  /** Equipos por los que pasó, del más reciente al más antiguo. */
  private async teamHistory(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT h.id, h.team_id, t.name AS team_name, t.logo_url, h.start_date, h.end_date,
                h.squad_number, h.note
         FROM dbo.player_team_history h
         JOIN dbo.teams t ON t.id = h.team_id
         WHERE h.player_id = @player_id
         ORDER BY h.start_date DESC, h.id DESC`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      teamLogoUrl: r.logo_url,
      startDate: r.start_date,
      endDate: r.end_date,
      squadNumber: r.squad_number,
      note: r.note,
      /** Sin fecha de fin = es el equipo actual (la base garantiza uno solo abierto por jugador). */
      current: r.end_date == null,
    }));
  }

  /** Totales de carrera. Los goles/asistencias/tarjetas salen de los eventos, no de un acumulador. */
  private async totals(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT
           (SELECT COUNT(*) FROM dbo.match_lineups WHERE player_id = @player_id) AS matches,
           (SELECT COUNT(*) FROM dbo.match_lineups WHERE player_id = @player_id AND is_starting = 1) AS starts,
           (SELECT ISNULL(SUM(minutes_played), 0) FROM dbo.match_lineups WHERE player_id = @player_id) AS minutes,
           (SELECT COUNT(*) FROM dbo.goals WHERE player_id = @player_id AND own_goal = 0) AS goals,
           (SELECT COUNT(*) FROM dbo.goals WHERE player_id = @player_id AND own_goal = 1) AS own_goals,
           (SELECT COUNT(*) FROM dbo.goals WHERE assist_player_id = @player_id) AS assists,
           (SELECT COUNT(*) FROM dbo.cards WHERE player_id = @player_id AND card_type = 'yellow') AS yellow_cards,
           (SELECT COUNT(*) FROM dbo.cards WHERE player_id = @player_id AND card_type IN ${RED_CARD_TYPES}) AS red_cards`,
      );
    // La consulta siempre debería traer una fila, pero si no la trae se devuelven ceros en vez de
    // romper la planilla entera (ninguna pantalla debe mostrar undefined/NaN).
    const r = result.recordset[0] ?? {};
    const matches = r.matches ?? 0;
    const starts = r.starts ?? 0;
    return {
      matches,
      starts,
      substituteAppearances: matches - starts,
      minutes: r.minutes ?? 0,
      goals: r.goals ?? 0,
      ownGoals: r.own_goals ?? 0,
      assists: r.assists ?? 0,
      yellowCards: r.yellow_cards ?? 0,
      redCards: r.red_cards ?? 0,
    };
  }

  /** Desglose por competición: dónde jugó y qué hizo en cada torneo. */
  private async byCompetition(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT c.id AS competition_id, c.name AS competition_name,
                COUNT(DISTINCT l.match_id) AS matches,
                ISNULL(SUM(l.minutes_played), 0) AS minutes,
                (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches gm ON gm.id = g.match_id
                  WHERE g.player_id = @player_id AND g.own_goal = 0 AND gm.competition_id = c.id) AS goals,
                (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches gm ON gm.id = g.match_id
                  WHERE g.assist_player_id = @player_id AND gm.competition_id = c.id) AS assists,
                (SELECT COUNT(*) FROM dbo.cards cd JOIN dbo.matches cm ON cm.id = cd.match_id
                  WHERE cd.player_id = @player_id AND cd.card_type = 'yellow' AND cm.competition_id = c.id) AS yellow_cards,
                (SELECT COUNT(*) FROM dbo.cards cd JOIN dbo.matches cm ON cm.id = cd.match_id
                  WHERE cd.player_id = @player_id AND cd.card_type IN ${RED_CARD_TYPES} AND cm.competition_id = c.id) AS red_cards
         FROM dbo.match_lineups l
         JOIN dbo.matches m ON m.id = l.match_id
         JOIN dbo.competitions c ON c.id = m.competition_id
         WHERE l.player_id = @player_id
         GROUP BY c.id, c.name
         ORDER BY matches DESC, competition_name ASC`,
      );
    return result.recordset.map((r) => ({
      competitionId: r.competition_id,
      competitionName: r.competition_name,
      matches: r.matches ?? 0,
      minutes: r.minutes ?? 0,
      goals: r.goals ?? 0,
      assists: r.assists ?? 0,
      yellowCards: r.yellow_cards ?? 0,
      redCards: r.red_cards ?? 0,
    }));
  }

  /**
   * Estadísticas individuales acumuladas. Devuelve `null` si la fuente nunca cargó ninguna fila,
   * para que la interfaz distinga "sin datos" de "todo en cero".
   */
  private async statTotals(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT COUNT(*) AS records,
                SUM(shots) AS shots, SUM(shots_on_target) AS shots_on_target,
                SUM(passes) AS passes, SUM(passes_completed) AS passes_completed,
                SUM(touches) AS touches, SUM(tackles) AS tackles, SUM(tackles_won) AS tackles_won,
                SUM(interceptions) AS interceptions, SUM(clearances) AS clearances,
                SUM(recoveries) AS recoveries,
                SUM(duels_ground_won) AS duels_ground_won, SUM(duels_ground_lost) AS duels_ground_lost,
                SUM(duels_aerial_won) AS duels_aerial_won, SUM(duels_aerial_lost) AS duels_aerial_lost,
                SUM(blocks_shots) AS blocks_shots, SUM(blocks_passes) AS blocks_passes
         FROM dbo.match_player_stats
         WHERE player_id = @player_id`,
      );
    const r = result.recordset[0];
    if (!r || (r.records ?? 0) === 0) return null;
    return {
      matchesWithStats: r.records,
      shots: r.shots,
      shotsOnTarget: r.shots_on_target,
      passes: r.passes,
      passesCompleted: r.passes_completed,
      touches: r.touches,
      tackles: r.tackles,
      tacklesWon: r.tackles_won,
      interceptions: r.interceptions,
      clearances: r.clearances,
      recoveries: r.recoveries,
      duelsGroundWon: r.duels_ground_won,
      duelsGroundLost: r.duels_ground_lost,
      duelsAerialWon: r.duels_aerial_won,
      duelsAerialLost: r.duels_aerial_lost,
      blocksShots: r.blocks_shots,
      blocksPasses: r.blocks_passes,
    };
  }

  /** Posiciones realmente jugadas, con cuántos partidos en cada una. */
  private async positionsPlayed(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT COALESCE(l.position, p.position) AS position, COUNT(*) AS matches
         FROM dbo.match_lineups l
         JOIN dbo.players p ON p.id = l.player_id
         WHERE l.player_id = @player_id AND COALESCE(l.position, p.position) IS NOT NULL
         GROUP BY COALESCE(l.position, p.position)
         ORDER BY matches DESC`,
      );
    return result.recordset.map((r) => ({ position: r.position, matches: r.matches }));
  }

  /** Planilla completa: trayectoria + totales + desglose + posiciones + estadísticas. */
  async getCareer(playerId: number) {
    await this.assertPlayerExists(playerId);
    const [teamHistory, totals, byCompetition, positions, statTotals] = await Promise.all([
      this.teamHistory(playerId),
      this.totals(playerId),
      this.byCompetition(playerId),
      this.positionsPlayed(playerId),
      this.statTotals(playerId),
    ]);
    return { teamHistory, totals, byCompetition, positions, statTotals };
  }

  /** Partido a partido, del más reciente al más antiguo. Paginado: un jugador puede tener cientos. */
  async getMatchLog(playerId: number, query: PlayerMatchLogQuery) {
    await this.assertPlayerExists(playerId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 20, 1), 100);

    const countResult = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query('SELECT COUNT(*) AS total FROM dbo.match_lineups WHERE player_id = @player_id');
    const total = countResult.recordset[0]?.total ?? 0;

    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('offset', sql.Int, (page - 1) * pageSize)
      .input('page_size', sql.Int, pageSize)
      .query(
        `SELECT l.match_id, m.match_date, m.status, c.name AS competition_name, s.label AS season_label,
                m.round, l.team_id, t.name AS team_name,
                CASE WHEN m.home_team_id = l.team_id THEN 1 ELSE 0 END AS is_home,
                CASE WHEN m.home_team_id = l.team_id THEN away.name ELSE home.name END AS opponent_name,
                ps.home_score, ps.away_score,
                l.is_starting, COALESCE(l.position, p.position) AS position,
                l.shirt_number, l.minutes_played,
                (SELECT COUNT(*) FROM dbo.goals g
                  WHERE g.match_id = l.match_id AND g.player_id = l.player_id AND g.own_goal = 0) AS goals,
                (SELECT COUNT(*) FROM dbo.goals g
                  WHERE g.match_id = l.match_id AND g.player_id = l.player_id AND g.own_goal = 1) AS own_goals,
                (SELECT COUNT(*) FROM dbo.goals g
                  WHERE g.match_id = l.match_id AND g.assist_player_id = l.player_id) AS assists,
                (SELECT COUNT(*) FROM dbo.cards cd
                  WHERE cd.match_id = l.match_id AND cd.player_id = l.player_id AND cd.card_type = 'yellow') AS yellow_cards,
                (SELECT COUNT(*) FROM dbo.cards cd
                  WHERE cd.match_id = l.match_id AND cd.player_id = l.player_id AND cd.card_type IN ${RED_CARD_TYPES}) AS red_cards
         FROM dbo.match_lineups l
         JOIN dbo.matches m ON m.id = l.match_id
         JOIN dbo.players p ON p.id = l.player_id
         JOIN dbo.teams t ON t.id = l.team_id
         JOIN dbo.teams home ON home.id = m.home_team_id
         JOIN dbo.teams away ON away.id = m.away_team_id
         JOIN dbo.competitions c ON c.id = m.competition_id
         LEFT JOIN dbo.seasons s ON s.id = m.season_id
         LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE l.player_id = @player_id
         ORDER BY m.match_date DESC, m.id DESC
         OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
      );

    const items = result.recordset.map((r) => ({
      matchId: r.match_id,
      matchDate: r.match_date,
      status: r.status,
      competitionName: r.competition_name,
      seasonLabel: r.season_label,
      round: r.round,
      teamId: r.team_id,
      teamName: r.team_name,
      isHome: !!r.is_home,
      opponentName: r.opponent_name,
      homeScore: r.home_score,
      awayScore: r.away_score,
      isStarting: !!r.is_starting,
      position: r.position,
      shirtNumber: r.shirt_number,
      minutesPlayed: r.minutes_played,
      goals: r.goals ?? 0,
      ownGoals: r.own_goals ?? 0,
      assists: r.assists ?? 0,
      yellowCards: r.yellow_cards ?? 0,
      redCards: r.red_cards ?? 0,
    }));

    return { items, total, page, pageSize };
  }
}
