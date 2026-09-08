import { BadRequestException, Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly service: StatsService) {}

  private scope(competitionId?: string, seasonId?: string) {
    return {
      competitionId: competitionId ? Number(competitionId) : undefined,
      seasonId: seasonId ? Number(seasonId) : undefined,
    };
  }

  @Get('overview')
  overview(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.service.overview(this.scope(competitionId, seasonId));
  }

  @Get('top-scorers')
  topScorers(
    @Query('competitionId') competitionId?: string,
    @Query('seasonId') seasonId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.topScorers(this.scope(competitionId, seasonId), this.parseLimit(limit));
  }

  @Get('top-assists')
  topAssists(
    @Query('competitionId') competitionId?: string,
    @Query('seasonId') seasonId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.topAssists(this.scope(competitionId, seasonId), this.parseLimit(limit));
  }

  @Get('cards-by-player')
  cardsByPlayer(
    @Query('competitionId') competitionId?: string,
    @Query('seasonId') seasonId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.cardsByPlayer(this.scope(competitionId, seasonId), this.parseLimit(limit));
  }

  @Get('goals-by-team')
  goalsByTeam(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.service.goalsByTeam(this.scope(competitionId, seasonId));
  }

  @Get('cards-by-team')
  cardsByTeam(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.service.cardsByTeam(this.scope(competitionId, seasonId));
  }

  @Get('matches-by-status')
  matchesByStatus(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.service.matchesByStatus(this.scope(competitionId, seasonId));
  }

  @Get('teams/:id/summary')
  teamSummary(@Param('id', ParseIntPipe) id: number) {
    return this.service.teamSummary(id);
  }

  @Get('players/:id/summary')
  playerSummary(@Param('id', ParseIntPipe) id: number, @Query('seasonId') seasonId?: string) {
    return this.service.playerSummary(id, seasonId ? Number(seasonId) : undefined);
  }

  @Get('goals-by-season')
  goalsBySeason(@Query('competitionId') competitionId?: string) {
    if (!competitionId) throw new BadRequestException('competitionId es obligatorio');
    return this.service.goalsBySeason(Number(competitionId));
  }

  @Get('match-stats-summary')
  matchStatsSummary(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.service.matchStatsSummary(this.scope(competitionId, seasonId));
  }

  @Get('match-extremes')
  matchExtremes(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.service.matchExtremes(this.scope(competitionId, seasonId));
  }

  @Get('teams-summary')
  teamsSummaryForCompetition(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    if (!competitionId) throw new BadRequestException('competitionId es obligatorio');
    return this.service.teamsSummaryForCompetition(Number(competitionId), seasonId ? Number(seasonId) : undefined);
  }

  private parseLimit(limit?: string): number {
    const n = limit ? Number(limit) : 10;
    if (!Number.isFinite(n) || n < 1) return 10;
    return Math.min(n, 50);
  }
}
