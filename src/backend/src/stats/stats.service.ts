import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

export interface StatsScope {
  competitionId?: number;
  seasonId?: number;
}

// Todas las consultas de este servicio leen directamente de las tablas de eventos ya construidas
// en el módulo de Partidos (goals/cards/matches) -- nada se hardcodea ni se inventa. Los autogoles
// se excluyen de "goles marcados"/"goleadores" (own_goal = 0): un autogol no es un gol a favor del
// jugador ni del equipo que lo metió en su arco, y el proyecto ya tiene precedente de NO derivar
// el marcador oficial desde dbo.goals (match_period_scores es carga manual aparte, ver v18) -- acá
// se sigue el mismo criterio de no inventar una atribución que la base no garantiza.
function applyScope(request: sql.Request, scope: StatsScope, alias: string): string[] {
  const conditions: string[] = [];
  if (scope.competitionId) {
    request.input('competition_id', sql.Int, scope.competitionId);
    conditions.push(`${alias}.competition_id = @competition_id`);
  }
  if (scope.seasonId) {
    request.input('season_id', sql.Int, scope.seasonId);
    conditions.push(`${alias}.season_id = @season_id`);
  }
  return conditions;
}

@Injectable()
export class StatsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async overview(scope: StatsScope) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(
      `SELECT
         (SELECT COUNT(*) FROM dbo.matches m ${whereSql}) AS total_matches,
         (SELECT COUNT(*) FROM dbo.matches m ${whereSql}${whereSql ? ' AND' : 'WHERE'} m.status = 'finished') AS finished_matches,
         (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id ${whereSql} ${whereSql ? 'AND' : 'WHERE'} g.own_goal = 0) AS total_goals,
         (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id ${whereSql} ${whereSql ? 'AND' : 'WHERE'} g.own_goal = 1) AS own_goals,
         (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id ${whereSql} ${whereSql ? 'AND' : 'WHERE'} g.penalty = 1) AS penalty_goals,
         (SELECT COUNT(*) FROM dbo.cards c JOIN dbo.matches m ON m.id = c.match_id ${whereSql}) AS total_cards,
         (SELECT COUNT(DISTINCT t.id) FROM dbo.teams t ${
           scope.competitionId
             ? 'JOIN dbo.season_teams st ON st.team_id = t.id JOIN dbo.seasons se ON se.id = st.season_id WHERE se.competition_id = @competition_id'
             : ''
         }) AS total_teams,
         (SELECT COUNT(DISTINCT p.id) FROM dbo.players p
            JOIN dbo.player_team_history h ON h.player_id = p.id AND h.end_date IS NULL
            JOIN dbo.teams t ON t.id = h.team_id ${
              scope.competitionId
                ? 'JOIN dbo.season_teams st ON st.team_id = t.id JOIN dbo.seasons se ON se.id = st.season_id WHERE se.competition_id = @competition_id'
                : ''
            }) AS total_players`,
    );
    const row = result.recordset[0];
    return {
      totalMatches: row.total_matches,
      finishedMatches: row.finished_matches,
      totalGoals: row.total_goals,
      ownGoals: row.own_goals,
      penaltyGoals: row.penalty_goals,
      totalCards: row.total_cards,
      totalTeams: row.total_teams,
      totalPlayers: row.total_players,
    };
  }

  // Splits local/empate/visitante + promedio de goles -- sólo cuenta partidos 'finished' que
  // además tienen marcador de tiempo completo cargado (mismo criterio de honestidad que
  // teamSummary: nunca se asume 0-0 cuando el resultado simplemente no se cargó).
  async matchStatsSummary(scope: StatsScope) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    where.push(`m.status = 'finished'`, `ps.period = 'full_time'`);
    const result = await request.query(
      `SELECT
         COUNT(*) AS played,
         SUM(CASE WHEN ps.home_score > ps.away_score THEN 1 ELSE 0 END) AS home_wins,
         SUM(CASE WHEN ps.home_score = ps.away_score THEN 1 ELSE 0 END) AS draws,
         SUM(CASE WHEN ps.home_score < ps.away_score THEN 1 ELSE 0 END) AS away_wins,
         SUM(ps.home_score) AS goals_home,
         SUM(ps.away_score) AS goals_away
       FROM dbo.matches m
       JOIN dbo.match_period_scores ps ON ps.match_id = m.id
       WHERE ${where.join(' AND ')}`,
    );
    const r = result.recordset[0];
    const played = r.played ?? 0;
    const goalsHome = r.goals_home ?? 0;
    const goalsAway = r.goals_away ?? 0;
    return {
      played,
      homeWins: r.home_wins ?? 0,
      draws: r.draws ?? 0,
      awayWins: r.away_wins ?? 0,
      goalsHome,
      goalsAway,
      avgGoalsPerMatch: played > 0 ? Math.round(((goalsHome + goalsAway) / played) * 100) / 100 : null,
    };
  }

  // "Récords" de partidos (§8 del pedido): mayor goleada, partido con más goles, partido con menos
  // goles -- cada uno como una fila real de dbo.matches, nunca inventado. TOP 1 con empate resuelto
  // por fecha más reciente; si no hay ningún partido con marcador cargado en el alcance pedido,
  // cada campo queda en null (no se fuerza ninguno).
  async matchExtremes(scope: StatsScope) {
    const pick = async (orderBy: string) => {
      const request = this.pool.request();
      const where = applyScope(request, scope, 'm');
      where.push(`m.status = 'finished'`, `ps.period = 'full_time'`);
      const result = await request.query(
        `SELECT TOP 1 m.id, m.match_date, ht.name AS home_name, at.name AS away_name, ps.home_score, ps.away_score
         FROM dbo.matches m
         JOIN dbo.match_period_scores ps ON ps.match_id = m.id
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         WHERE ${where.join(' AND ')}
         ORDER BY ${orderBy}`,
      );
      const row = result.recordset[0];
      if (!row) return null;
      return {
        matchId: row.id,
        matchDate: row.match_date,
        homeTeamName: row.home_name,
        awayTeamName: row.away_name,
        homeScore: row.home_score,
        awayScore: row.away_score,
      };
    };

    const [biggestWin, highestScoring, lowestScoring] = await Promise.all([
      pick('ABS(ps.home_score - ps.away_score) DESC, m.match_date DESC'),
      pick('(ps.home_score + ps.away_score) DESC, m.match_date DESC'),
      pick('(ps.home_score + ps.away_score) ASC, m.match_date DESC'),
    ]);
    return { biggestWin, highestScoring, lowestScoring };
  }

  // Resumen histórico por equipo CRUZANDO todas las temporadas de la competición (a diferencia de
  // Clasificación, que siempre es de una sola temporada) -- opcionalmente acotado a una temporada
  // puntual si se pasa seasonId, para que "Estadísticas por equipo" pueda usar el mismo selector de
  // temporada que el resto de la pestaña.
  async teamsSummaryForCompetition(competitionId: number, seasonId?: number) {
    const request = this.pool
      .request()
      .input('competition_id', sql.Int, competitionId);
    if (seasonId) request.input('season_id', sql.Int, seasonId);
    const seasonFilter = seasonId ? 'AND m.season_id = @season_id' : '';
    const result = await request.query(
      `WITH team_matches AS (
         SELECT m.id AS match_id, m.home_team_id AS team_id, ps.home_score AS gf, ps.away_score AS ga
         FROM dbo.matches m
         JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE m.competition_id = @competition_id AND m.status = 'finished' ${seasonFilter}
         UNION ALL
         SELECT m.id, m.away_team_id, ps.away_score, ps.home_score
         FROM dbo.matches m
         JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE m.competition_id = @competition_id AND m.status = 'finished' ${seasonFilter}
       )
       SELECT t.id AS team_id, t.name AS team_name,
              COUNT(tm.match_id) AS played,
              SUM(CASE WHEN tm.gf > tm.ga THEN 1 ELSE 0 END) AS won,
              SUM(CASE WHEN tm.gf = tm.ga THEN 1 ELSE 0 END) AS drawn,
              SUM(CASE WHEN tm.gf < tm.ga THEN 1 ELSE 0 END) AS lost,
              ISNULL(SUM(tm.gf), 0) AS goals_for,
              ISNULL(SUM(tm.ga), 0) AS goals_against
       FROM dbo.teams t
       LEFT JOIN team_matches tm ON tm.team_id = t.id
       -- Equipos que REALMENTE participaron en esta competición (season_teams -> seasons), nunca
       -- t.competition_id -- un club puede haber participado en muchas competiciones distintas.
       WHERE EXISTS (
         SELECT 1 FROM dbo.season_teams st JOIN dbo.seasons se ON se.id = st.season_id
         WHERE st.team_id = t.id AND se.competition_id = @competition_id ${seasonId ? 'AND se.id = @season_id' : ''}
       )
       GROUP BY t.id, t.name
       ORDER BY won DESC, (ISNULL(SUM(tm.gf), 0) - ISNULL(SUM(tm.ga), 0)) DESC, t.name`,
    );
    return result.recordset.map((r) => ({
      teamId: r.team_id,
      teamName: r.team_name,
      played: r.played,
      won: r.won ?? 0,
      drawn: r.drawn ?? 0,
      lost: r.lost ?? 0,
      goalsFor: r.goals_for,
      goalsAgainst: r.goals_against,
    }));
  }

  async topScorers(scope: StatsScope, limit: number) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    where.push('g.own_goal = 0');
    request.input('limit', sql.Int, limit);
    const result = await request.query(
      `SELECT TOP (@limit) p.id AS player_id, p.full_name AS player_name, t.id AS team_id, t.name AS team_name,
              COUNT(*) AS goals
       FROM dbo.goals g
       JOIN dbo.matches m ON m.id = g.match_id
       JOIN dbo.players p ON p.id = g.player_id
       JOIN dbo.teams t ON t.id = g.team_id
       WHERE ${where.join(' AND ')}
       GROUP BY p.id, p.full_name, t.id, t.name
       ORDER BY COUNT(*) DESC, p.full_name`,
    );
    return result.recordset.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      teamId: r.team_id,
      teamName: r.team_name,
      goals: r.goals,
    }));
  }

  async topAssists(scope: StatsScope, limit: number) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    where.push('g.assist_player_id IS NOT NULL');
    request.input('limit', sql.Int, limit);
    const result = await request.query(
      `SELECT TOP (@limit) p.id AS player_id, p.full_name AS player_name, t.id AS team_id, t.name AS team_name,
              COUNT(*) AS assists
       FROM dbo.goals g
       JOIN dbo.matches m ON m.id = g.match_id
       JOIN dbo.players p ON p.id = g.assist_player_id
       JOIN dbo.teams t ON t.id = g.team_id
       WHERE ${where.join(' AND ')}
       GROUP BY p.id, p.full_name, t.id, t.name
       ORDER BY COUNT(*) DESC, p.full_name`,
    );
    return result.recordset.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      teamId: r.team_id,
      teamName: r.team_name,
      assists: r.assists,
    }));
  }

  async cardsByPlayer(scope: StatsScope, limit: number) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    request.input('limit', sql.Int, limit);
    const result = await request.query(
      `SELECT TOP (@limit) p.id AS player_id, p.full_name AS player_name, t.id AS team_id, t.name AS team_name,
              SUM(CASE WHEN c.card_type = 'yellow' THEN 1 ELSE 0 END) AS yellow_cards,
              SUM(CASE WHEN c.card_type IN ('red', 'second_yellow') THEN 1 ELSE 0 END) AS red_cards
       FROM dbo.cards c
       JOIN dbo.matches m ON m.id = c.match_id
       JOIN dbo.players p ON p.id = c.player_id
       JOIN dbo.teams t ON t.id = c.team_id
       ${whereSql}
       GROUP BY p.id, p.full_name, t.id, t.name
       ORDER BY (SUM(CASE WHEN c.card_type = 'yellow' THEN 1 ELSE 0 END) + SUM(CASE WHEN c.card_type IN ('red', 'second_yellow') THEN 1 ELSE 0 END)) DESC, p.full_name`,
    );
    return result.recordset.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      teamId: r.team_id,
      teamName: r.team_name,
      yellowCards: r.yellow_cards,
      redCards: r.red_cards,
    }));
  }

  // A diferencia de topScorers (que sí depende de dbo.goals -- ahí la atribución al jugador
  // concreto es el dato pedido, y no existe otra fuente), acá el total por EQUIPO ya está
  // garantizado por el resultado oficial cargado en match_period_scores para prácticamente todos
  // los partidos, mientras que dbo.goals sólo tiene la atribución evento-por-evento cuando la
  // fuente la daba (hoy, un solo partido). Usar match_period_scores es más completo Y sigue sin
  // inventar nada: es el marcador real ya cargado, no una derivación nueva.
  async goalsByTeam(scope: StatsScope) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    const whereSql = where.length ? `AND ${where.join(' AND ')}` : '';
    const result = await request.query(
      `SELECT t.id AS team_id, t.name AS team_name, SUM(x.goals) AS goals
       FROM (
         SELECT m.home_team_id AS team_id, ps.home_score AS goals
         FROM dbo.match_period_scores ps
         JOIN dbo.matches m ON m.id = ps.match_id
         WHERE ps.period = 'full_time' ${whereSql}
         UNION ALL
         SELECT m.away_team_id AS team_id, ps.away_score AS goals
         FROM dbo.match_period_scores ps
         JOIN dbo.matches m ON m.id = ps.match_id
         WHERE ps.period = 'full_time' ${whereSql}
       ) x
       JOIN dbo.teams t ON t.id = x.team_id
       GROUP BY t.id, t.name
       HAVING SUM(x.goals) > 0
       ORDER BY SUM(x.goals) DESC, t.name`,
    );
    return result.recordset.map((r) => ({ teamId: r.team_id, teamName: r.team_name, goals: r.goals }));
  }

  async cardsByTeam(scope: StatsScope) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(
      `SELECT t.id AS team_id, t.name AS team_name,
              SUM(CASE WHEN c.card_type = 'yellow' THEN 1 ELSE 0 END) AS yellow_cards,
              SUM(CASE WHEN c.card_type IN ('red', 'second_yellow') THEN 1 ELSE 0 END) AS red_cards
       FROM dbo.cards c
       JOIN dbo.matches m ON m.id = c.match_id
       JOIN dbo.teams t ON t.id = c.team_id
       ${whereSql}
       GROUP BY t.id, t.name
       ORDER BY (SUM(CASE WHEN c.card_type = 'yellow' THEN 1 ELSE 0 END) + SUM(CASE WHEN c.card_type IN ('red', 'second_yellow') THEN 1 ELSE 0 END)) DESC, t.name`,
    );
    return result.recordset.map((r) => ({
      teamId: r.team_id,
      teamName: r.team_name,
      yellowCards: r.yellow_cards,
      redCards: r.red_cards,
    }));
  }

  async matchesByStatus(scope: StatsScope) {
    const request = this.pool.request();
    const where = applyScope(request, scope, 'm');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await request.query(
      `SELECT m.status, COUNT(*) AS total FROM dbo.matches m ${whereSql} GROUP BY m.status ORDER BY COUNT(*) DESC`,
    );
    return result.recordset.map((r) => ({ status: r.status, total: r.total }));
  }

  // Totales históricos de un equipo, cruzando TODAS sus competiciones/temporadas -- distinto de
  // Clasificaciones (que es siempre una tabla de una sola temporada). Mismo criterio de honestidad
  // que Clasificaciones: sólo partidos 'finished' cuentan, y sólo los que además tienen marcador de
  // tiempo completo cargado se usan para determinar resultado/goles (matchesMissingScore separado).
  async teamSummary(teamId: number) {
    const result = await this.pool.request().input('team_id', sql.Int, teamId).query(
      `WITH team_matches AS (
         SELECT m.id AS match_id, ps.home_score AS gf, ps.away_score AS ga
         FROM dbo.matches m
         LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE m.home_team_id = @team_id AND m.status = 'finished'
         UNION ALL
         SELECT m.id AS match_id, ps.away_score AS gf, ps.home_score AS ga
         FROM dbo.matches m
         LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE m.away_team_id = @team_id AND m.status = 'finished'
       )
       SELECT
         COUNT(*) AS played,
         SUM(CASE WHEN gf IS NULL THEN 1 ELSE 0 END) AS missing_score,
         SUM(CASE WHEN gf > ga THEN 1 ELSE 0 END) AS won,
         SUM(CASE WHEN gf = ga AND gf IS NOT NULL THEN 1 ELSE 0 END) AS drawn,
         SUM(CASE WHEN gf < ga THEN 1 ELSE 0 END) AS lost,
         SUM(gf) AS goals_for,
         SUM(ga) AS goals_against,
         (SELECT COUNT(*) FROM dbo.cards c WHERE c.team_id = @team_id AND c.card_type = 'yellow') AS yellow_cards,
         (SELECT COUNT(*) FROM dbo.cards c WHERE c.team_id = @team_id AND c.card_type IN ('red', 'second_yellow')) AS red_cards
       FROM team_matches`,
    );
    const r = result.recordset[0];
    return {
      played: r.played ?? 0,
      won: r.won ?? 0,
      drawn: r.drawn ?? 0,
      lost: r.lost ?? 0,
      goalsFor: r.goals_for ?? 0,
      goalsAgainst: r.goals_against ?? 0,
      yellowCards: r.yellow_cards ?? 0,
      redCards: r.red_cards ?? 0,
      matchesMissingScore: r.missing_score ?? 0,
    };
  }

  // seasonId opcional: alimenta el historial del jugador por período (Fase 11 del pedido -- elegir
  // un año/temporada de su historial de clubes y ver las estadísticas reales de ESE período, no
  // sólo el acumulado de toda la carrera).
  async playerSummary(playerId: number, seasonId?: number) {
    const request = this.pool.request().input('player_id', sql.Int, playerId);
    let seasonFilter = '';
    if (seasonId) {
      request.input('season_id', sql.Int, seasonId);
      seasonFilter = 'AND m.season_id = @season_id';
    }
    const result = await request.query(
      `SELECT
         (SELECT COUNT(DISTINCT ml.match_id) FROM dbo.match_lineups ml
            JOIN dbo.matches m ON m.id = ml.match_id
            WHERE ml.player_id = @player_id AND m.status = 'finished' ${seasonFilter}) AS matches_played,
         (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id
            WHERE g.player_id = @player_id AND g.own_goal = 0 ${seasonFilter}) AS goals,
         (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id
            WHERE g.assist_player_id = @player_id ${seasonFilter}) AS assists,
         (SELECT COUNT(*) FROM dbo.cards c JOIN dbo.matches m ON m.id = c.match_id
            WHERE c.player_id = @player_id AND c.card_type = 'yellow' ${seasonFilter}) AS yellow_cards,
         (SELECT COUNT(*) FROM dbo.cards c JOIN dbo.matches m ON m.id = c.match_id
            WHERE c.player_id = @player_id AND c.card_type IN ('red', 'second_yellow') ${seasonFilter}) AS red_cards`,
    );
    const r = result.recordset[0];
    return {
      matchesPlayed: r.matches_played ?? 0,
      goals: r.goals ?? 0,
      assists: r.assists ?? 0,
      yellowCards: r.yellow_cards ?? 0,
      redCards: r.red_cards ?? 0,
    };
  }

  async goalsBySeason(competitionId: number) {
    const result = await this.pool
      .request()
      .input('competition_id', sql.Int, competitionId)
      .query(
        `SELECT s.id AS season_id, s.label AS season_label, COUNT(g.id) AS goals
         FROM dbo.seasons s
         LEFT JOIN dbo.matches m ON m.season_id = s.id
         LEFT JOIN dbo.goals g ON g.match_id = m.id AND g.own_goal = 0
         WHERE s.competition_id = @competition_id
         GROUP BY s.id, s.label, s.start_year
         ORDER BY s.start_year`,
      );
    return result.recordset.map((r) => ({ seasonId: r.season_id, seasonLabel: r.season_label, goals: r.goals }));
  }
}
