import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlayDto, UpdatePlayDto } from './dto/play.dto';
import { SaveSetupDto } from './dto/setup.dto';
import {
  CreateCustomEventDto,
  CreateEventTypeDto,
  CreateMetricDto,
  CreatePossessionDto,
  CreateSetPieceDto,
  UpdateMetricDto,
} from './dto/tactics-misc.dto';
import { TacticsService } from './tactics.service';

@Controller('tactics')
@UseGuards(JwtAuthGuard)
export class TacticsController {
  constructor(private readonly service: TacticsService) {}

  // Planteos
  @Get('matches/:matchId/setups')
  listSetups(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.listSetups(matchId);
  }

  @Post('matches/:matchId/setups')
  saveSetup(@Param('matchId', ParseIntPipe) matchId: number, @Body() dto: SaveSetupDto) {
    return this.service.saveSetup(matchId, dto);
  }

  @Delete('setups/:id')
  async removeSetup(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeSetup(id);
    return { message: 'Planteo eliminado' };
  }

  // Biblioteca de jugadas
  @Get('plays')
  listPlays(@Query('search') search?: string, @Query('category') category?: string) {
    return this.service.listPlays({ search, category });
  }

  @Post('plays')
  createPlay(@Body() dto: CreatePlayDto) {
    return this.service.createPlay(dto);
  }

  @Get('plays/:id')
  getPlay(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPlay(id);
  }

  @Put('plays/:id')
  updatePlay(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlayDto) {
    return this.service.updatePlay(id, dto);
  }

  @Delete('plays/:id')
  async removePlay(@Param('id', ParseIntPipe) id: number) {
    await this.service.removePlay(id);
    return { message: 'Jugada eliminada' };
  }

  @Post('plays/:id/use')
  registerPlayUse(@Param('id', ParseIntPipe) id: number) {
    return this.service.registerPlayUse(id);
  }

  // Posesiones
  @Get('matches/:matchId/possessions')
  listPossessions(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.listPossessions(matchId);
  }

  @Post('matches/:matchId/possessions')
  createPossession(@Param('matchId', ParseIntPipe) matchId: number, @Body() dto: CreatePossessionDto) {
    return this.service.createPossession(matchId, dto);
  }

  @Delete('matches/:matchId/possessions/:possessionId')
  async removePossession(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Param('possessionId', ParseIntPipe) possessionId: number,
  ) {
    await this.service.removePossession(matchId, possessionId);
    return { message: 'Posesión eliminada' };
  }

  // Eventos personalizados
  @Get('event-types')
  listEventTypes() {
    return this.service.listEventTypes();
  }

  @Post('event-types')
  createEventType(@Body() dto: CreateEventTypeDto) {
    return this.service.createEventType(dto);
  }

  @Delete('event-types/:id')
  async removeEventType(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeEventType(id);
    return { message: 'Tipo de evento eliminado' };
  }

  @Get('matches/:matchId/custom-events')
  listCustomEvents(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.listCustomEvents(matchId);
  }

  @Post('matches/:matchId/custom-events')
  createCustomEvent(@Param('matchId', ParseIntPipe) matchId: number, @Body() dto: CreateCustomEventDto) {
    return this.service.createCustomEvent(matchId, dto);
  }

  @Delete('matches/:matchId/custom-events/:eventId')
  async removeCustomEvent(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    await this.service.removeCustomEvent(matchId, eventId);
    return { message: 'Evento eliminado' };
  }

  // Métricas
  @Get('metrics')
  listMetrics() {
    return this.service.listMetrics();
  }

  @Post('metrics')
  createMetric(@Body() dto: CreateMetricDto) {
    return this.service.createMetric(dto);
  }

  @Put('metrics/:id')
  updateMetric(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMetricDto) {
    return this.service.updateMetric(id, dto);
  }

  @Delete('metrics/:id')
  async removeMetric(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeMetric(id);
    return { message: 'Métrica eliminada' };
  }

  @Post('metrics/:id/evaluate')
  evaluateMetric(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { matchId: number; teamId?: number },
  ) {
    return this.service.evaluateMetric(id, body.matchId, body.teamId);
  }

  // Balón parado
  @Get('matches/:matchId/set-pieces')
  listSetPieces(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.listSetPieces(matchId);
  }

  @Post('matches/:matchId/set-pieces')
  createSetPiece(@Param('matchId', ParseIntPipe) matchId: number, @Body() dto: CreateSetPieceDto) {
    return this.service.createSetPiece(matchId, dto);
  }

  @Delete('matches/:matchId/set-pieces/:setPieceId')
  async removeSetPiece(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Param('setPieceId', ParseIntPipe) setPieceId: number,
  ) {
    await this.service.removeSetPiece(matchId, setPieceId);
    return { message: 'Registro eliminado' };
  }

  // Mapa de tiros
  @Get('matches/:matchId/shot-map')
  getShotMap(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.getShotMap(matchId);
  }
}
