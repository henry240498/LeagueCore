import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvenanceService } from '../research/provenance.service';
import { PlayerCareerService } from './player-career.service';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [AuthModule],
  controllers: [PlayersController],
  providers: [PlayersService, ProvenanceService, PlayerCareerService],
  exports: [PlayersService],
})
export class PlayersModule {}
