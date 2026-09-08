import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOfficialTypeDto } from './dto/create-official-type.dto';
import { OfficialTypesService } from './official-types.service';

class SetStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

// Catálogo chico dentro del propio módulo Oficiales (no un nav item ni un módulo de
// Configuración/Parametrización): ver docs/ANALISIS_INICIAL_LEAGUECORE.md v16.
@Controller('official-types')
@UseGuards(JwtAuthGuard)
export class OfficialTypesController {
  constructor(private readonly service: OfficialTypesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateOfficialTypeDto) {
    return this.service.create(dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto) {
    return this.service.setStatus(id, dto.status);
  }
}
