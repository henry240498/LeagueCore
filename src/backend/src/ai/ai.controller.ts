import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';

class AskDto {
  @IsString()
  @MaxLength(1000)
  question!: string;

  @IsOptional() @IsInt() teamId?: number;
  @IsOptional() @IsInt() matchId?: number;
  @IsOptional() @IsString() @MaxLength(150) createdBy?: string;
}

class SaveReportDto {
  @IsIn(['RESUMEN_PARTIDO', 'SCOUTING', 'TENDENCIA', 'RESPUESTA'])
  kind!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  content!: string;

  @IsOptional() @IsString() @MaxLength(30) entityType?: string;
  @IsOptional() @IsInt() entityId?: number;
  @IsOptional() @IsString() @MaxLength(150) createdBy?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('ask')
  ask(@Body() dto: AskDto) {
    return this.service.ask(dto.question, { teamId: dto.teamId, matchId: dto.matchId, createdBy: dto.createdBy });
  }

  @Post('summarize/:matchId')
  async summarize(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.service.summarizeMatch(matchId);
  }

  @Get('trends')
  trends(@Query('teamId') teamId?: string) {
    return this.service.trends(teamId ? Number(teamId) : undefined);
  }

  @Get('queries')
  listQueries(@Query('limit') limit?: string) {
    return this.service.listQueries(limit ? Number(limit) : undefined);
  }

  @Post('reports')
  saveReport(@Body() dto: SaveReportDto) {
    return this.service.saveReport(dto.kind, dto.title, dto.content, dto.entityType, dto.entityId, dto.createdBy);
  }

  @Get('reports')
  listReports(@Query('kind') kind?: string) {
    return this.service.listReports(kind);
  }
}
