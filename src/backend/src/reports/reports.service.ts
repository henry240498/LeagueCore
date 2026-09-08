import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

export interface ReportScope {
  competitionId?: number;
  seasonId?: number;
}

// Reportes cruzados que no pertenecen a ningún módulo de dominio existente (Árbitros/Estadios no
// tienen "actuaciones"/"partidos disputados" propios, Seguridad nunca expuso lectura de
// dbo.audit_log) -- todo lee de tablas que YA existen (match_officials, cards, fouls,
// penalty_kicks, venues, audit_log), nada se duplica ni se inventa acá.
function applyMatchScope(request: sql.Request, scope: ReportScope): string {
  const conditions: string[] = [];
  if (scope.competitionId) {
    request.input('competition_id', sql.Int, scope.competitionId);
    conditions.push('m.competition_id = @competition_id');
  }
  if (scope.seasonId) {
    request.input('season_id', sql.Int, scope.seasonId);
    conditions.push('m.season_id = @season_id');
  }
  return conditions.length ? `AND ${conditions.join(' AND ')}` : '';
}

@Injectable()
export class ReportsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // "Árbitro" = rol main_referee en match_officials (asistentes/VAR no se reportan acá, ese no es
  // el sentido habitual de "actuaciones arbitrales"). Tarjetas/faltas/penales son los que ocurrieron
  // en los partidos que dirigió, no eventos sobre el árbitro mismo.
  async refereeReport(scope: ReportScope) {
    const request = this.pool.request();
    const matchScope = applyMatchScope(request, scope);
    const result = await request.query(
      `SELECT o.id AS official_id, o.full_name AS official_name, o.nationality,
              (SELECT COUNT(DISTINCT mo.match_id) FROM dbo.match_officials mo
                 JOIN dbo.matches m ON m.id = mo.match_id
                 WHERE mo.official_id = o.id AND mo.role = 'main_referee' ${matchScope}) AS matches_directed,
              (SELECT COUNT(*) FROM dbo.cards c
                 JOIN dbo.match_officials mo ON mo.match_id = c.match_id AND mo.official_id = o.id AND mo.role = 'main_referee'
                 JOIN dbo.matches m ON m.id = c.match_id
                 WHERE c.card_type = 'yellow' ${matchScope}) AS yellow_cards,
              (SELECT COUNT(*) FROM dbo.cards c
                 JOIN dbo.match_officials mo ON mo.match_id = c.match_id AND mo.official_id = o.id AND mo.role = 'main_referee'
                 JOIN dbo.matches m ON m.id = c.match_id
                 WHERE c.card_type IN ('red', 'second_yellow') ${matchScope}) AS red_cards,
              (SELECT COUNT(*) FROM dbo.fouls f
                 JOIN dbo.match_officials mo ON mo.match_id = f.match_id AND mo.official_id = o.id AND mo.role = 'main_referee'
                 JOIN dbo.matches m ON m.id = f.match_id
                 WHERE 1 = 1 ${matchScope}) AS fouls,
              (SELECT COUNT(*) FROM dbo.penalty_kicks pk
                 JOIN dbo.match_officials mo ON mo.match_id = pk.match_id AND mo.official_id = o.id AND mo.role = 'main_referee'
                 JOIN dbo.matches m ON m.id = pk.match_id
                 WHERE 1 = 1 ${matchScope}) AS penalties
       FROM dbo.officials o
       WHERE EXISTS (SELECT 1 FROM dbo.match_officials mo WHERE mo.official_id = o.id AND mo.role = 'main_referee')
       ORDER BY matches_directed DESC, o.full_name`,
    );
    return result.recordset
      .map((r) => ({
        officialId: r.official_id,
        officialName: r.official_name,
        nationality: r.nationality,
        matchesDirected: r.matches_directed,
        yellowCards: r.yellow_cards,
        redCards: r.red_cards,
        fouls: r.fouls,
        penalties: r.penalties,
      }))
      .filter((r) => r.matchesDirected > 0);
  }

  async refereeMatches(officialId: number, scope: ReportScope) {
    const request = this.pool.request().input('official_id', sql.Int, officialId);
    const matchScope = applyMatchScope(request, scope);
    const result = await request.query(
      `SELECT m.id, m.match_date, c.name AS competition_name, s.label AS season_label,
              ht.name AS home_team_name, at.name AS away_team_name, m.status,
              ps.home_score, ps.away_score
       FROM dbo.match_officials mo
       JOIN dbo.matches m ON m.id = mo.match_id
       JOIN dbo.competitions c ON c.id = m.competition_id
       JOIN dbo.seasons s ON s.id = m.season_id
       JOIN dbo.teams ht ON ht.id = m.home_team_id
       JOIN dbo.teams at ON at.id = m.away_team_id
       LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
       WHERE mo.official_id = @official_id AND mo.role = 'main_referee' ${matchScope}
       ORDER BY m.match_date DESC`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      matchDate: r.match_date,
      competitionName: r.competition_name,
      seasonLabel: r.season_label,
      homeTeamName: r.home_team_name,
      awayTeamName: r.away_team_name,
      status: r.status,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));
  }

  // dbo.venues no tiene columnas de superficie/césped/asistencia propia (nunca se pidieron ni se
  // cargaron) -- el reporte muestra lo que sí existe (partidos/equipos/competiciones distintas) y
  // deja el resto para que el frontend lo muestre honestamente como "No disponible".
  async venueReport() {
    const result = await this.pool.request().query(
      `SELECT v.id AS venue_id, v.name, v.city, v.country, v.capacity,
              COUNT(DISTINCT m.id) AS matches_played,
              COUNT(DISTINCT m.competition_id) AS competitions_count,
              COUNT(DISTINCT CASE WHEN m.home_team_id IS NOT NULL THEN m.home_team_id END)
                + COUNT(DISTINCT CASE WHEN m.away_team_id IS NOT NULL THEN m.away_team_id END) AS teams_count_raw
       FROM dbo.venues v
       LEFT JOIN dbo.matches m ON m.venue_id = v.id
       GROUP BY v.id, v.name, v.city, v.country, v.capacity
       ORDER BY COUNT(DISTINCT m.id) DESC, v.name`,
    );
    return result.recordset.map((r) => ({
      venueId: r.venue_id,
      name: r.name,
      city: r.city,
      country: r.country,
      capacity: r.capacity,
      matchesPlayed: r.matches_played,
      competitionsCount: r.competitions_count,
    }));
  }

  async venueMatches(venueId: number) {
    const result = await this.pool
      .request()
      .input('venue_id', sql.Int, venueId)
      .query(
        `SELECT m.id, m.match_date, c.name AS competition_name, ht.name AS home_team_name, at.name AS away_team_name,
                m.status, ps.home_score, ps.away_score
         FROM dbo.matches m
         JOIN dbo.competitions c ON c.id = m.competition_id
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE m.venue_id = @venue_id
         ORDER BY m.match_date DESC`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      matchDate: r.match_date,
      competitionName: r.competition_name,
      homeTeamName: r.home_team_name,
      awayTeamName: r.away_team_name,
      status: r.status,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));
  }

  // "Enfrentamientos" -- todos los partidos finalizados entre dos equipos, en cualquier
  // competición/temporada (no se limita el alcance salvo por los dos equipos elegidos, a
  // diferencia del resto de los reportes que sí aceptan competencia/temporada).
  async headToHead(teamAId: number, teamBId: number) {
    const result = await this.pool
      .request()
      .input('team_a', sql.Int, teamAId)
      .input('team_b', sql.Int, teamBId)
      .query(
        `SELECT m.id, m.match_date, c.name AS competition_name, s.label AS season_label,
                m.home_team_id, ht.name AS home_team_name, ht.logo_url AS home_team_logo_url,
                m.away_team_id, at.name AS away_team_name, at.logo_url AS away_team_logo_url,
                m.status, m.round, m.phase, v.name AS venue_name, ps.home_score, ps.away_score
         FROM dbo.matches m
         JOIN dbo.competitions c ON c.id = m.competition_id
         JOIN dbo.seasons s ON s.id = m.season_id
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         LEFT JOIN dbo.venues v ON v.id = m.venue_id
         LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
         WHERE (m.home_team_id = @team_a AND m.away_team_id = @team_b)
            OR (m.home_team_id = @team_b AND m.away_team_id = @team_a)
         ORDER BY m.match_date DESC`,
      );
    const matches = result.recordset.map((r) => ({
      id: r.id,
      matchDate: r.match_date,
      competitionName: r.competition_name,
      seasonLabel: r.season_label,
      homeTeamId: r.home_team_id,
      homeTeamName: r.home_team_name,
      homeTeamLogoUrl: r.home_team_logo_url,
      awayTeamId: r.away_team_id,
      awayTeamName: r.away_team_name,
      awayTeamLogoUrl: r.away_team_logo_url,
      status: r.status,
      round: r.round,
      phase: r.phase,
      venueName: r.venue_name,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));

    let winsA = 0;
    let winsB = 0;
    let draws = 0;
    let goalsA = 0;
    let goalsB = 0;
    let missingScore = 0;
    for (const m of matches) {
      if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) {
        if (m.status === 'finished') missingScore++;
        continue;
      }
      const scoreA = m.homeTeamId === teamAId ? m.homeScore : m.awayScore;
      const scoreB = m.homeTeamId === teamAId ? m.awayScore : m.homeScore;
      goalsA += scoreA;
      goalsB += scoreB;
      if (scoreA > scoreB) winsA++;
      else if (scoreB > scoreA) winsB++;
      else draws++;
    }

    return { matches, winsA, winsB, draws, goalsA, goalsB, matchesMissingScore: missingScore };
  }

  // Sólo lee lo que dbo.audit_log ya registra hoy (action/entity/entity_id/details/ip/fecha) -- esa
  // tabla NO guarda campo/valor anterior/valor nuevo, así que el reporte no inventa esas columnas.
  async auditLog(filters: { userId?: number; action?: string; entity?: string; dateFrom?: string; dateTo?: string }, page: number, pageSize: number) {
    const request = this.pool.request();
    const conditions: string[] = [];
    if (filters.userId) {
      request.input('user_id', sql.Int, filters.userId);
      conditions.push('a.user_id = @user_id');
    }
    if (filters.action) {
      request.input('action', sql.NVarChar, filters.action);
      conditions.push('a.action = @action');
    }
    if (filters.entity) {
      request.input('entity', sql.NVarChar, filters.entity);
      conditions.push('a.entity = @entity');
    }
    if (filters.dateFrom) {
      request.input('date_from', sql.DateTime2, filters.dateFrom);
      conditions.push('a.created_at >= @date_from');
    }
    if (filters.dateTo) {
      request.input('date_to', sql.DateTime2, filters.dateTo);
      conditions.push('a.created_at <= @date_to');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(page, 1) - 1) * pageSize;
    request.input('offset', sql.Int, offset);
    request.input('page_size', sql.Int, pageSize);

    const result = await request.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.ip_address, a.created_at,
              u.username, COUNT(*) OVER() AS total_count
       FROM dbo.audit_log a
       LEFT JOIN dbo.users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`,
    );
    return {
      items: result.recordset.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        details: r.details,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
        username: r.username,
      })),
      total: result.recordset[0]?.total_count ?? 0,
      page,
      pageSize,
    };
  }

  async auditActions() {
    const result = await this.pool.request().query('SELECT DISTINCT action FROM dbo.audit_log ORDER BY action');
    return result.recordset.map((r) => r.action as string);
  }

  async auditEntities() {
    const result = await this.pool
      .request()
      .query("SELECT DISTINCT entity FROM dbo.audit_log WHERE entity IS NOT NULL ORDER BY entity");
    return result.recordset.map((r) => r.entity as string);
  }
}
