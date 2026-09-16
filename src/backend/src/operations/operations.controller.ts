import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateExerciseDto,
  CreateObjectiveDto,
  CreateTrainingDto,
  SetAttendanceDto,
  UpdateObjectiveDto,
} from './dto/operations.dto';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get('trainings')
  listTrainings(@Query('teamId') teamId?: string) {
    return this.service.listTrainings(teamId ? Number(teamId) : undefined);
  }

  @Post('trainings')
  createTraining(@Body() dto: CreateTrainingDto) {
    return this.service.createTraining(dto);
  }

  @Delete('trainings/:id')
  async removeTraining(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeTraining(id);
    return { message: 'Sesión eliminada' };
  }

  @Get('trainings/:id/attendance')
  getAttendance(@Param('id', ParseIntPipe) id: number) {
    return this.service.getAttendance(id);
  }

  @Post('trainings/:id/attendance')
  setAttendance(@Param('id', ParseIntPipe) id: number, @Body() dto: SetAttendanceDto) {
    return this.service.setAttendance(id, dto);
  }

  @Get('exercises')
  listExercises(@Query('search') search?: string) {
    return this.service.listExercises(search);
  }

  @Post('exercises')
  createExercise(@Body() dto: CreateExerciseDto) {
    return this.service.createExercise(dto);
  }

  @Delete('exercises/:id')
  async removeExercise(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeExercise(id);
    return { message: 'Ejercicio eliminado' };
  }

  @Get('players/:playerId/objectives')
  listPlayerObjectives(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.service.listPlayerObjectives(playerId);
  }

  @Post('players/:playerId/objectives')
  createPlayerObjective(@Param('playerId', ParseIntPipe) playerId: number, @Body() dto: CreateObjectiveDto) {
    return this.service.createPlayerObjective(playerId, dto);
  }

  @Patch('player-objectives/:id')
  updatePlayerObjective(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateObjectiveDto) {
    return this.service.updatePlayerObjective(id, dto);
  }

  @Delete('player-objectives/:id')
  async removePlayerObjective(@Param('id', ParseIntPipe) id: number) {
    await this.service.removePlayerObjective(id);
    return { message: 'Objetivo eliminado' };
  }

  @Get('teams/:teamId/objectives')
  listTeamObjectives(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.listTeamObjectives(teamId);
  }

  @Post('teams/:teamId/objectives')
  createTeamObjective(@Param('teamId', ParseIntPipe) teamId: number, @Body() dto: CreateObjectiveDto) {
    return this.service.createTeamObjective(teamId, dto);
  }

  @Patch('team-objectives/:id')
  updateTeamObjective(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateObjectiveDto) {
    return this.service.updateTeamObjective(id, dto);
  }

  @Delete('team-objectives/:id')
  async removeTeamObjective(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeTeamObjective(id);
    return { message: 'Objetivo eliminado' };
  }

  @Get('teams/:teamId/context')
  getTeamContext(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.getTeamContext(teamId);
  }

  @Get('matches/:matchId/sub-impact')
  getSubImpact(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.getSubImpact(matchId);
  }

  @Get('discipline')
  getDiscipline(@Query('teamId') teamId?: string) {
    return this.service.getDiscipline(teamId ? Number(teamId) : undefined);
  }

  @Get('referees')
  getRefereeStats() {
    return this.service.getRefereeStats();
  }

  @Get('alerts')
  listAlerts(@Query('status') status?: string) {
    return this.service.listAlerts(status);
  }

  @Post('alerts/check')
  runAlertCheck() {
    return this.service.runAlertCheck();
  }

  @Patch('alerts/:id')
  resolveAlert(@Param('id', ParseIntPipe) id: number, @Body() body: { status: 'LEIDA' | 'RESUELTA' }) {
    return this.service.resolveAlert(id, body.status);
  }

  @Get('overview')
  getOverview(@Query('teamId') teamId?: string, @Query('playerId') playerId?: string) {
    return this.service.getOverview(
      teamId ? Number(teamId) : undefined,
      playerId ? Number(playerId) : undefined,
    );
  }
}
