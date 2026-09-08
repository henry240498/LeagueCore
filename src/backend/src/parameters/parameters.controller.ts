import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateParameterDto } from './dto/create-parameter.dto';
import { UpdateParameterDto } from './dto/update-parameter.dto';
import { ParametersService } from './parameters.service';

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

// Parametrizaciones es admin-only (§3/§9 del pedido de roles) -- antes sólo exigía estar
// logueado, lo cual dejaba estos endpoints alcanzables por cualquier usuario autenticado. Ningún
// otro módulo deportivo llama a este endpoint (verificado: sólo ParametersPage.tsx lo usa; los
// formularios de Partidos/Jugadores/etc. usan sus propias listas fijas en el frontend), así que
// este cambio no rompe nada fuera de la propia pantalla de Parametrizaciones.
@Controller()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class ParametersController {
  constructor(private readonly service: ParametersService) {}

  @Get('parameter-categories')
  listCategories() {
    return this.service.listCategories();
  }

  @Get('parameter-categories/:code/parameters')
  listParameters(@Param('code') code: string, @Query('includeInactive') includeInactive?: string) {
    return this.service.listParameters(code, includeInactive === 'true');
  }

  @Post('parameter-categories/:code/parameters')
  create(@Param('code') code: string, @Body() dto: CreateParameterDto) {
    return this.service.create(code, dto);
  }

  @Patch('parameters/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParameterDto) {
    return this.service.update(id, dto);
  }

  @Patch('parameters/:id/active')
  setActive(@Param('id', ParseIntPipe) id: number, @Body() dto: SetActiveDto) {
    return this.service.setActive(id, dto.isActive);
  }

  @Delete('parameters/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Valor eliminado' };
  }
}
