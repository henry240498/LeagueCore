import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { TEAM_CATEGORIES } from './dto/create-staff.dto';
import { UpdateClubDto } from './dto/update-club.dto';

class SetStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

class LinkTeamDto {
  @IsInt()
  teamId!: number;

  @IsOptional()
  @IsString()
  @IsIn([...TEAM_CATEGORIES])
  category?: string;
}

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(private readonly service: ClubsService) {}

  @Get()
  list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.service.list({ search, status });
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateClubDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClubDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Club eliminado' };
  }

  @Get(':id/teams')
  getTeams(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTeams(id);
  }

  @Post(':id/teams')
  linkTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkTeamDto) {
    return this.service.linkTeam(id, dto.teamId, dto.category);
  }

  @Delete(':id/teams/:teamId')
  unlinkTeam(@Param('id', ParseIntPipe) id: number, @Param('teamId', ParseIntPipe) teamId: number) {
    return this.service.unlinkTeam(id, teamId);
  }

  @Get(':id/staff')
  getStaff(@Param('id', ParseIntPipe) id: number) {
    return this.service.getStaff(id);
  }

  @Post(':id/staff')
  addStaff(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateStaffDto) {
    return this.service.addStaff(id, dto);
  }

  @Delete(':id/staff/:staffId')
  async removeStaff(
    @Param('id', ParseIntPipe) id: number,
    @Param('staffId', ParseIntPipe) staffId: number,
  ) {
    await this.service.removeStaff(id, staffId);
    return { message: 'Miembro del staff eliminado' };
  }
}
