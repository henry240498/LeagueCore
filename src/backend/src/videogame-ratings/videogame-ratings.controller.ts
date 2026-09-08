import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVideogameRatingDto } from './dto/create-videogame-rating.dto';
import { VideogameRatingsService } from './videogame-ratings.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class VideogameRatingsController {
  constructor(private readonly service: VideogameRatingsService) {}

  @Get('videogames')
  listVideogames() {
    return this.service.listVideogames();
  }

  @Get('player-videogame-attribute-categories')
  listCategories() {
    return this.service.listCategories();
  }

  @Get('players/:playerId/videogame-ratings')
  listForPlayer(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.service.listForPlayer(playerId);
  }

  @Post('players/:playerId/videogame-ratings')
  create(@Param('playerId', ParseIntPipe) playerId: number, @Body() dto: CreateVideogameRatingDto) {
    return this.service.upsertRating(playerId, dto);
  }
}
