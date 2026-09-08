import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddSeasonTeamDto } from './dto/add-season-team.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { SeasonsService } from './seasons.service';

class SetStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

class SetCurrentDto {
  @IsBoolean()
  isCurrent!: boolean;
}

@Controller('seasons')
@UseGuards(JwtAuthGuard)
export class SeasonsController {
  constructor(private readonly service: SeasonsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('competitionId') competitionId?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      search,
      competitionId: competitionId ? Number(competitionId) : undefined,
      status,
      sortBy,
      sortDir,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Get(':id/standings')
  getStandings(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStandings(id);
  }

  @Post()
  create(@Body() dto: CreateSeasonDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeasonDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Patch(':id/current')
  setCurrent(@Param('id', ParseIntPipe) id: number, @Body() dto: SetCurrentDto) {
    return this.service.setCurrent(id, dto.isCurrent);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Temporada eliminada' };
  }

  @Post(':id/teams')
  addTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: AddSeasonTeamDto) {
    return this.service.addTeam(id, dto.teamId);
  }

  @Delete(':id/teams/:teamId')
  removeTeam(@Param('id', ParseIntPipe) id: number, @Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.removeTeam(id, teamId);
  }
}
