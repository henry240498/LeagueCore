import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInformalTournamentDto } from './dto/create-informal-tournament.dto';
import { UpdateInformalTournamentDto } from './dto/update-informal-tournament.dto';
import { InformalTournamentsService } from './informal-tournaments.service';

@Controller('informal-tournaments')
@UseGuards(JwtAuthGuard)
export class InformalTournamentsController {
  constructor(private readonly service: InformalTournamentsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('format') format?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.service.list({ search, status, format, sortBy, sortDir });
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateInformalTournamentDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInformalTournamentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Torneo informal eliminado' };
  }
}
