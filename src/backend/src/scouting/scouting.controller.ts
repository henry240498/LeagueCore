import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateRivalReportDto,
  CreateScoutingReportDto,
  CreateWatchItemDto,
  SaveRivalProfileDto,
  UpdateWatchItemDto,
} from './dto/scouting.dto';
import { ScoutingService } from './scouting.service';

@Controller('scouting')
@UseGuards(JwtAuthGuard)
export class ScoutingController {
  constructor(private readonly service: ScoutingService) {}

  // Rivales
  @Get('rivals/:teamId/profile')
  getRivalProfile(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.getRivalProfile(teamId);
  }

  @Put('rivals/:teamId/profile')
  saveRivalProfile(@Param('teamId', ParseIntPipe) teamId: number, @Body() dto: SaveRivalProfileDto) {
    return this.service.saveRivalProfile(teamId, dto);
  }

  @Get('rivals/:teamId/history')
  getRivalHistory(@Param('teamId', ParseIntPipe) teamId: number, @Query('limit') limit?: string) {
    return this.service.getRivalHistory(teamId, limit ? Number(limit) : undefined);
  }

  @Get('rivals/:teamId/reports')
  listRivalReports(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.listRivalReports(teamId);
  }

  @Post('rivals/:teamId/reports')
  createRivalReport(@Param('teamId', ParseIntPipe) teamId: number, @Body() dto: CreateRivalReportDto) {
    return this.service.createRivalReport(teamId, dto);
  }

  @Delete('rivals/:teamId/reports/:reportId')
  async removeRivalReport(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
  ) {
    await this.service.removeRivalReport(teamId, reportId);
    return { message: 'Informe eliminado' };
  }

  // Jugadores
  @Get('players')
  searchPlayers(
    @Query('search') search?: string,
    @Query('position') position?: string,
    @Query('nationality') nationality?: string,
    @Query('foot') foot?: string,
    @Query('teamId') teamId?: string,
    @Query('minAge') minAge?: string,
    @Query('maxAge') maxAge?: string,
    @Query('minHeight') minHeight?: string,
    @Query('minGoals') minGoals?: string,
    @Query('minTechAvg') minTechAvg?: string,
  ) {
    return this.service.searchPlayers({
      search,
      position,
      nationality,
      foot,
      teamId: teamId ? Number(teamId) : undefined,
      minAge: minAge ? Number(minAge) : undefined,
      maxAge: maxAge ? Number(maxAge) : undefined,
      minHeight: minHeight ? Number(minHeight) : undefined,
      minGoals: minGoals ? Number(minGoals) : undefined,
      minTechAvg: minTechAvg ? Number(minTechAvg) : undefined,
    });
  }

  @Get('compare')
  comparePlayers(@Query('ids') ids?: string) {
    // Sin `ids` no hay que romper con un 500: el servicio responde 400 ("Compará entre 2 y 4 jugadores").
    return this.service.comparePlayers((ids ?? '').split(',').map(Number).filter(Number.isFinite));
  }

  // Informes de scouting
  @Get('reports')
  listScoutingReports(@Query('playerId') playerId?: string) {
    return this.service.listScoutingReports(playerId ? Number(playerId) : undefined);
  }

  @Post('reports')
  createScoutingReport(@Body() dto: CreateScoutingReportDto) {
    return this.service.createScoutingReport(dto);
  }

  @Delete('reports/:id')
  async removeScoutingReport(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeScoutingReport(id);
    return { message: 'Informe eliminado' };
  }

  // Watchlist
  @Get('watchlist')
  listWatchlist(@Query('status') status?: string) {
    return this.service.listWatchlist(status);
  }

  @Post('watchlist')
  addWatchItem(@Body() dto: CreateWatchItemDto) {
    return this.service.addWatchItem(dto);
  }

  @Put('watchlist/:id')
  updateWatchItem(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWatchItemDto) {
    return this.service.updateWatchItem(id, dto);
  }

  @Delete('watchlist/:id')
  async removeWatchItem(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeWatchItem(id);
    return { message: 'Seguimiento eliminado' };
  }
}
