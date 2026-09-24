import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MATCH_STATUSES } from './constants';
import { AddCardDto } from './dto/add-card.dto';
import { AddFoulDto } from './dto/add-foul.dto';
import { AddGoalDto } from './dto/add-goal.dto';
import { AddInterruptionDto } from './dto/add-interruption.dto';
import { AddLineupEntryDto } from './dto/add-lineup-entry.dto';
import { AddMatchCoachDto } from './dto/add-match-coach.dto';
import { AddMatchOfficialDto } from './dto/add-match-official.dto';
import { AddOffsideDto } from './dto/add-offside.dto';
import { AddPenaltyKickDto } from './dto/add-penalty-kick.dto';
import { AddShootoutKickDto } from './dto/add-shootout-kick.dto';
import { AddShotDto } from './dto/add-shot.dto';
import { AddSubstitutionDto } from './dto/add-substitution.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { SetLineupPositionDto } from './dto/set-lineup-position.dto';
import { SetMatchFormationDto } from './dto/set-match-formation.dto';
import { SetPeriodScoreDto } from './dto/set-period-score.dto';
import {
  ImportAdvancedMetricsDto,
  ImportPlayerPhysicalDto,
  ImportPlayerPositionsDto,
} from './dto/import-match-data.dto';
import { SetPlayerStatsDto } from './dto/set-player-stats.dto';
import { SetTeamStatsDto } from './dto/set-team-stats.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchEventsService } from './match-events.service';
import { MatchImportService } from './match-import.service';
import { MatchParticipantsService } from './match-participants.service';
import { MatchStatsService } from './match-stats.service';
import { MatchesService } from './matches.service';

class SetStatusDto {
  @IsIn(MATCH_STATUSES)
  status!: string;
}

function requestMeta(req: AuthenticatedRequest) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly events: MatchEventsService,
    private readonly participants: MatchParticipantsService,
    private readonly stats: MatchStatsService,
    private readonly imports: MatchImportService,
  ) {}

  // ---------- Núcleo ----------
  @Get()
  list(
    @Query('search') search?: string,
    @Query('competitionId') competitionId?: string,
    @Query('seasonId') seasonId?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.matches.list({
      search,
      competitionId: competitionId ? Number(competitionId) : undefined,
      seasonId: seasonId ? Number(seasonId) : undefined,
      teamId: teamId ? Number(teamId) : undefined,
      status,
      sortBy,
      sortDir,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('check-duplicates')
  checkDuplicates(
    @Query('competitionId') competitionId: string,
    @Query('homeTeamId') homeTeamId: string,
    @Query('awayTeamId') awayTeamId: string,
    @Query('matchDate') matchDate: string,
  ) {
    return this.matches.checkDuplicates(Number(competitionId), Number(homeTeamId), Number(awayTeamId), matchDate);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.matches.getById(id);
  }

  @Post()
  create(@Body() dto: CreateMatchDto, @Req() req: AuthenticatedRequest) {
    return this.matches.create(dto, requestMeta(req), req.user!.id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMatchDto, @Req() req: AuthenticatedRequest) {
    return this.matches.update(id, dto, requestMeta(req), req.user!.id);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto, @Req() req: AuthenticatedRequest) {
    return this.matches.setStatus(id, dto.status, requestMeta(req), req.user!.id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    await this.matches.remove(id, requestMeta(req), req.user!.id);
    return { message: 'Partido eliminado' };
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.matches.getHistory(id);
  }

  // ---------- Resultado por periodos ----------
  @Put(':id/result')
  setResult(@Param('id', ParseIntPipe) id: number, @Body() dto: SetPeriodScoreDto, @Req() req: AuthenticatedRequest) {
    return this.matches.setPeriodScore(id, dto, requestMeta(req), req.user!.id);
  }

  @Delete(':id/result/:period')
  removeResult(@Param('id', ParseIntPipe) id: number, @Param('period') period: string, @Req() req: AuthenticatedRequest) {
    return this.matches.removePeriodScore(id, period, requestMeta(req), req.user!.id);
  }

  // ---------- Oficiales ----------
  @Get(':id/officials')
  listOfficials(@Param('id', ParseIntPipe) id: number) {
    return this.participants.listOfficials(id);
  }

  @Post(':id/officials')
  addOfficial(@Param('id', ParseIntPipe) id: number, @Body() dto: AddMatchOfficialDto) {
    return this.participants.addOfficial(id, dto);
  }

  @Delete(':id/officials/:matchOfficialId')
  async removeOfficial(@Param('id', ParseIntPipe) id: number, @Param('matchOfficialId', ParseIntPipe) matchOfficialId: number) {
    await this.participants.removeOfficial(id, matchOfficialId);
    return { message: 'Oficial quitado del partido' };
  }

  // ---------- Cuerpo técnico ----------
  @Get(':id/coaches')
  listCoaches(@Param('id', ParseIntPipe) id: number) {
    return this.participants.listCoaches(id);
  }

  @Post(':id/coaches')
  addCoach(@Param('id', ParseIntPipe) id: number, @Body() dto: AddMatchCoachDto) {
    return this.participants.addCoach(id, dto);
  }

  @Delete(':id/coaches/:matchCoachId')
  async removeCoach(@Param('id', ParseIntPipe) id: number, @Param('matchCoachId', ParseIntPipe) matchCoachId: number) {
    await this.participants.removeCoach(id, matchCoachId);
    return { message: 'Entrenador quitado del partido' };
  }

  // ---------- Alineaciones ----------
  @Get(':id/lineups')
  listLineups(@Param('id', ParseIntPipe) id: number) {
    return this.participants.listLineups(id);
  }

  @Post(':id/lineups')
  addLineupEntry(@Param('id', ParseIntPipe) id: number, @Body() dto: AddLineupEntryDto) {
    return this.participants.addLineupEntry(id, dto);
  }

  @Delete(':id/lineups/:lineupId')
  async removeLineupEntry(@Param('id', ParseIntPipe) id: number, @Param('lineupId', ParseIntPipe) lineupId: number) {
    await this.participants.removeLineupEntry(id, lineupId);
    return { message: 'Jugador quitado del partido' };
  }

  @Patch(':id/lineups/:lineupId/position')
  async setLineupPosition(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineupId', ParseIntPipe) lineupId: number,
    @Body() dto: SetLineupPositionDto,
  ) {
    await this.participants.setLineupPosition(id, lineupId, dto.posX, dto.posY);
    return { message: 'Posición guardada' };
  }

  // ---------- Formación táctica (por equipo, no por jugador) ----------
  @Get(':id/formations')
  listFormations(@Param('id', ParseIntPipe) id: number) {
    return this.participants.listFormations(id);
  }

  @Put(':id/formations')
  setFormation(@Param('id', ParseIntPipe) id: number, @Body() dto: SetMatchFormationDto) {
    return this.participants.setFormation(id, dto);
  }

  // ---------- Analítica avanzada (sólo lectura -- esquema real, sin datos reales todavía) ----------
  @Get(':id/positions')
  listPlayerPositions(@Param('id', ParseIntPipe) id: number, @Query('playerId') playerId?: string) {
    return this.participants.listPlayerPositions(id, playerId ? Number(playerId) : undefined);
  }

  @Get(':id/advanced-metrics')
  listAdvancedMetrics(@Param('id', ParseIntPipe) id: number, @Query('playerId') playerId?: string) {
    return this.participants.listAdvancedMetrics(id, playerId ? Number(playerId) : undefined);
  }

  @Get(':id/players/:playerId/physical-stats')
  getPhysicalStats(@Param('id', ParseIntPipe) id: number, @Param('playerId', ParseIntPipe) playerId: number) {
    return this.participants.getPhysicalStats(id, playerId);
  }

  // ---------- Timeline (lectura combinada) ----------
  @Get(':id/timeline')
  getTimeline(@Param('id', ParseIntPipe) id: number) {
    return this.events.getTimeline(id);
  }

  // ---------- Eventos ----------
  @Post(':id/goals')
  addGoal(@Param('id', ParseIntPipe) id: number, @Body() dto: AddGoalDto) {
    return this.events.addGoal(id, dto);
  }

  @Delete(':id/goals/:goalId')
  async removeGoal(@Param('id', ParseIntPipe) id: number, @Param('goalId', ParseIntPipe) goalId: number) {
    await this.events.removeGoal(id, goalId);
    return { message: 'Gol eliminado' };
  }

  @Post(':id/cards')
  addCard(@Param('id', ParseIntPipe) id: number, @Body() dto: AddCardDto) {
    return this.events.addCard(id, dto);
  }

  @Delete(':id/cards/:cardId')
  async removeCard(@Param('id', ParseIntPipe) id: number, @Param('cardId', ParseIntPipe) cardId: number) {
    await this.events.removeCard(id, cardId);
    return { message: 'Tarjeta eliminada' };
  }

  @Post(':id/substitutions')
  addSubstitution(@Param('id', ParseIntPipe) id: number, @Body() dto: AddSubstitutionDto) {
    return this.events.addSubstitution(id, dto);
  }

  @Delete(':id/substitutions/:subId')
  async removeSubstitution(@Param('id', ParseIntPipe) id: number, @Param('subId', ParseIntPipe) subId: number) {
    await this.events.removeSubstitution(id, subId);
    return { message: 'Sustitución eliminada' };
  }

  @Post(':id/fouls')
  addFoul(@Param('id', ParseIntPipe) id: number, @Body() dto: AddFoulDto) {
    return this.events.addFoul(id, dto);
  }

  @Delete(':id/fouls/:foulId')
  async removeFoul(@Param('id', ParseIntPipe) id: number, @Param('foulId', ParseIntPipe) foulId: number) {
    await this.events.removeFoul(id, foulId);
    return { message: 'Falta eliminada' };
  }

  @Post(':id/offsides')
  addOffside(@Param('id', ParseIntPipe) id: number, @Body() dto: AddOffsideDto) {
    return this.events.addOffside(id, dto);
  }

  @Delete(':id/offsides/:offsideId')
  async removeOffside(@Param('id', ParseIntPipe) id: number, @Param('offsideId', ParseIntPipe) offsideId: number) {
    await this.events.removeOffside(id, offsideId);
    return { message: 'Fuera de juego eliminado' };
  }

  @Post(':id/shots')
  addShot(@Param('id', ParseIntPipe) id: number, @Body() dto: AddShotDto) {
    return this.events.addShot(id, dto);
  }

  @Delete(':id/shots/:shotId')
  async removeShot(@Param('id', ParseIntPipe) id: number, @Param('shotId', ParseIntPipe) shotId: number) {
    await this.events.removeShot(id, shotId);
    return { message: 'Tiro eliminado' };
  }

  @Get(':id/shot-map')
  getShotMap(@Param('id', ParseIntPipe) id: number) {
    return this.events.getShotMap(id);
  }

  @Post(':id/interruptions')
  addInterruption(@Param('id', ParseIntPipe) id: number, @Body() dto: AddInterruptionDto) {
    return this.events.addInterruption(id, dto);
  }

  @Delete(':id/interruptions/:interruptionId')
  async removeInterruption(
    @Param('id', ParseIntPipe) id: number,
    @Param('interruptionId', ParseIntPipe) interruptionId: number,
  ) {
    await this.events.removeInterruption(id, interruptionId);
    return { message: 'Interrupción eliminada' };
  }

  @Post(':id/penalty-kicks')
  addPenaltyKick(@Param('id', ParseIntPipe) id: number, @Body() dto: AddPenaltyKickDto) {
    return this.events.addPenaltyKick(id, dto);
  }

  @Delete(':id/penalty-kicks/:penaltyId')
  async removePenaltyKick(@Param('id', ParseIntPipe) id: number, @Param('penaltyId', ParseIntPipe) penaltyId: number) {
    await this.events.removePenaltyKick(id, penaltyId);
    return { message: 'Penal eliminado' };
  }

  // ---------- Tanda de penales ----------
  @Get(':id/shootout-kicks')
  listShootoutKicks(@Param('id', ParseIntPipe) id: number) {
    return this.events.listShootoutKicks(id);
  }

  @Post(':id/shootout-kicks')
  addShootoutKick(@Param('id', ParseIntPipe) id: number, @Body() dto: AddShootoutKickDto) {
    return this.events.addShootoutKick(id, dto);
  }

  @Delete(':id/shootout-kicks/:kickId')
  async removeShootoutKick(@Param('id', ParseIntPipe) id: number, @Param('kickId', ParseIntPipe) kickId: number) {
    await this.events.removeShootoutKick(id, kickId);
    return { message: 'Lanzamiento eliminado' };
  }

  // ---------- Estadísticas de equipo ----------
  @Get(':id/team-stats')
  listTeamStats(@Param('id', ParseIntPipe) id: number) {
    return this.stats.list(id);
  }

  @Put(':id/team-stats/:teamId')
  setTeamStats(
    @Param('id', ParseIntPipe) id: number,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: SetTeamStatsDto,
  ) {
    return this.stats.setForTeam(id, teamId, dto);
  }

  // ---------- Estadísticas individuales (por jugador) ----------
  @Get(':id/player-stats')
  listPlayerStats(@Param('id', ParseIntPipe) id: number) {
    return this.stats.listPlayerStats(id);
  }

  @Put(':id/player-stats/:playerId')
  setPlayerStats(
    @Param('id', ParseIntPipe) id: number,
    @Param('playerId', ParseIntPipe) playerId: number,
    @Body() dto: SetPlayerStatsDto,
  ) {
    return this.stats.setForPlayer(id, playerId, dto);
  }

  // ---------- Importación masiva de datos avanzados ----------
  // Estas tres tablas no tenían forma de cargarse y su volumen descarta hacerlo a mano.

  /** Métricas avanzadas (xG, xA, PPDA…). Reemplaza las del partido: reimportar corrige, no duplica. */
  @Post(':id/import/advanced-metrics')
  importAdvancedMetrics(@Param('id', ParseIntPipe) id: number, @Body() dto: ImportAdvancedMetricsDto) {
    return this.imports.importAdvancedMetrics(id, dto);
  }

  /** Muestras de posición para mapa de calor / posición media. También reemplaza las del partido. */
  @Post(':id/import/player-positions')
  importPlayerPositions(@Param('id', ParseIntPipe) id: number, @Body() dto: ImportPlayerPositionsDto) {
    return this.imports.importPlayerPositions(id, dto);
  }

  /** Datos físicos (GPS) por jugador. Upsert por (partido, jugador). */
  @Post(':id/import/player-physical')
  importPlayerPhysical(@Param('id', ParseIntPipe) id: number, @Body() dto: ImportPlayerPhysicalDto) {
    return this.imports.importPlayerPhysical(id, dto);
  }
}
