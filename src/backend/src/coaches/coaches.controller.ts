import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoachesService } from './coaches.service';
import { CreateCoachDto } from './dto/create-coach.dto';

@Controller('coaches')
@UseGuards(JwtAuthGuard)
export class CoachesController {
  constructor(private readonly service: CoachesService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateCoachDto) {
    return this.service.create(dto);
  }
}
