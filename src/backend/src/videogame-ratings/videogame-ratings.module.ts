import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VideogameRatingsController } from './videogame-ratings.controller';
import { VideogameRatingsService } from './videogame-ratings.service';

@Module({
  imports: [AuthModule],
  controllers: [VideogameRatingsController],
  providers: [VideogameRatingsService],
})
export class VideogameRatingsModule {}
