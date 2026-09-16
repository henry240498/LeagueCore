import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/insights.dto';
import { InsightsService } from './insights.service';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('matches/:matchId/maps')
  getMatchMaps(
    @Param('matchId', ParseIntPipe) matchId: number,
    @Query('teamId') teamId?: string,
    @Query('playerId') playerId?: string,
  ) {
    return this.service.getMatchMaps(
      matchId,
      teamId ? Number(teamId) : undefined,
      playerId ? Number(playerId) : undefined,
    );
  }

  @Get('matches/:matchId/score-state')
  getScoreState(@Param('matchId', ParseIntPipe) matchId: number, @Query('teamId') teamId: string) {
    return this.service.getScoreState(matchId, Number(teamId));
  }

  @Get('teams/:teamId/state-profile')
  getTeamStateProfile(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.getTeamStateProfile(teamId);
  }

  @Get('report-templates')
  listTemplates(@Query('entity') entity?: string) {
    return this.service.listTemplates(entity);
  }

  @Post('report-templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Put('report-templates/:id')
  updateTemplate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemplateDto) {
    return this.service.updateTemplate(id, dto);
  }

  @Delete('report-templates/:id')
  async removeTemplate(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeTemplate(id);
    return { message: 'Plantilla eliminada' };
  }

  @Post('report-templates/:id/generate')
  generate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { matchId?: number; teamId?: number; playerId?: number },
  ) {
    return this.service.generate(id, body);
  }
}
