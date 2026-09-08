import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import type { Response } from 'express';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSavedReportDto } from './dto/create-saved-report.dto';
import { ReportsService } from './reports.service';
import { SavedReportsService } from './saved-reports.service';
import { buildXlsxWorkbook, type ExportSheet } from './xlsx-export';

class ExportXlsxDto {
  @IsString() filename!: string;
  @IsArray() sheets!: ExportSheet[];
}

function scope(competitionId?: string, seasonId?: string) {
  return {
    competitionId: competitionId ? Number(competitionId) : undefined,
    seasonId: seasonId ? Number(seasonId) : undefined,
  };
}

// Reportes visibles para cualquier usuario autenticado (viewer/editor/admin) -- §3/§4 del pedido no
// restringe la simple visualización a admin, sólo GUARDAR/EXPORTAR/ADMINISTRAR requieren más (acá:
// guardar/borrar reportes de otros; Auditoría específicamente queda admin-only por integrarse con
// Seguridad, mismo criterio que el resto de esa sección).
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly saved: SavedReportsService,
  ) {}

  @Get('referees')
  refereeReport(@Query('competitionId') competitionId?: string, @Query('seasonId') seasonId?: string) {
    return this.reports.refereeReport(scope(competitionId, seasonId));
  }

  @Get('referees/:id/matches')
  refereeMatches(
    @Param('id', ParseIntPipe) id: number,
    @Query('competitionId') competitionId?: string,
    @Query('seasonId') seasonId?: string,
  ) {
    return this.reports.refereeMatches(id, scope(competitionId, seasonId));
  }

  @Get('venues')
  venueReport() {
    return this.reports.venueReport();
  }

  @Get('venues/:id/matches')
  venueMatches(@Param('id', ParseIntPipe) id: number) {
    return this.reports.venueMatches(id);
  }

  @Get('head-to-head')
  headToHead(@Query('teamAId') teamAId?: string, @Query('teamBId') teamBId?: string) {
    if (!teamAId || !teamBId) throw new BadRequestException('Elegí los dos equipos a comparar');
    return this.reports.headToHead(Number(teamAId), Number(teamBId));
  }

  @Get('audit')
  @UseGuards(AdminOnlyGuard)
  auditLog(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reports.auditLog(
      { userId: userId ? Number(userId) : undefined, action, entity, dateFrom, dateTo },
      page ? Number(page) : 1,
      pageSize ? Math.min(Number(pageSize), 100) : 25,
    );
  }

  @Get('audit/actions')
  @UseGuards(AdminOnlyGuard)
  auditActions() {
    return this.reports.auditActions();
  }

  @Get('audit/entities')
  @UseGuards(AdminOnlyGuard)
  auditEntities() {
    return this.reports.auditEntities();
  }

  // Exportación real a Excel (.xlsx) -- toma lo que el frontend ya tiene renderizado (misma data
  // que ve el admin en pantalla, ninguna consulta nueva) y genera el libro. Abierto a cualquier
  // autenticado, igual que el resto de este controller (§29 del pedido: ver/exportar reportes no
  // está restringido a admin).
  @Post('export-xlsx')
  exportXlsx(@Body() dto: ExportXlsxDto, @Res() res: Response) {
    const buffer = buildXlsxWorkbook(dto.sheets);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${dto.filename}"`,
    });
    res.send(buffer);
  }

  // ---------- Reportes guardados / favoritos ----------
  @Get('saved')
  listSaved(@Req() req: AuthenticatedRequest) {
    return this.saved.list(req.user!.id, req.user!.role === 'admin');
  }

  @Post('saved')
  createSaved(@Body() dto: CreateSavedReportDto, @Req() req: AuthenticatedRequest) {
    return this.saved.create(req.user!.id, dto);
  }

  @Patch('saved/:id/favorite')
  toggleFavorite(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.saved.toggleFavorite(id, req.user!.id, req.user!.role === 'admin');
  }

  @Delete('saved/:id')
  async removeSaved(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    await this.saved.remove(id, req.user!.id, req.user!.role === 'admin');
    return { message: 'Reporte guardado eliminado' };
  }
}
