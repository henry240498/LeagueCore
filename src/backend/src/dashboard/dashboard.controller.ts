import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  @Get('stats')
  async stats() {
    const result = await this.pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.competitions) AS competiciones,
        (SELECT COUNT(*) FROM dbo.teams)        AS equipos,
        (SELECT COUNT(*) FROM dbo.matches)      AS partidos,
        (SELECT COUNT(*) FROM dbo.players)      AS jugadores,
        (SELECT COUNT(*) FROM dbo.officials)    AS oficiales,
        (SELECT COUNT(*) FROM dbo.seasons)      AS temporadas,
        (SELECT COUNT(*) FROM dbo.venues)       AS estadios,
        (SELECT COUNT(*) FROM dbo.sync_runs)    AS investigaciones
    `);
    return result.recordset[0];
  }

  @Get('upcoming-matches')
  async upcomingMatches() {
    const result = await this.pool.request().query(`
      SELECT TOP 5 m.id, m.match_date, m.match_time, c.name AS competition_name,
             ht.name AS home_team_name, at.name AS away_team_name
      FROM dbo.matches m
      JOIN dbo.competitions c ON c.id = m.competition_id
      JOIN dbo.teams ht ON ht.id = m.home_team_id
      JOIN dbo.teams at ON at.id = m.away_team_id
      WHERE m.status = 'scheduled' AND m.match_date >= CAST(SYSUTCDATETIME() AS DATE)
      ORDER BY m.match_date ASC, m.match_time ASC
    `);
    return result.recordset.map((r) => ({
      id: r.id,
      matchDate: r.match_date,
      matchTime: r.match_time,
      competitionName: r.competition_name,
      homeTeamName: r.home_team_name,
      awayTeamName: r.away_team_name,
    }));
  }

  @Get('recent-matches')
  async recentMatches() {
    const result = await this.pool.request().query(`
      SELECT TOP 5 m.id, m.match_date, c.name AS competition_name,
             ht.name AS home_team_name, at.name AS away_team_name,
             hs.home_score, hs.away_score
      FROM dbo.matches m
      JOIN dbo.competitions c ON c.id = m.competition_id
      JOIN dbo.teams ht ON ht.id = m.home_team_id
      JOIN dbo.teams at ON at.id = m.away_team_id
      LEFT JOIN dbo.match_period_scores hs ON hs.match_id = m.id AND hs.period = 'full_time'
      WHERE m.status = 'finished'
      ORDER BY m.match_date DESC
    `);
    return result.recordset.map((r) => ({
      id: r.id,
      matchDate: r.match_date,
      competitionName: r.competition_name,
      homeTeamName: r.home_team_name,
      awayTeamName: r.away_team_name,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));
  }
}
