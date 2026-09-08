import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { MatchesModule } from '../matches/matches.module';
import { PlayersModule } from '../players/players.module';
import { TeamsModule } from '../teams/teams.module';
import { ConflictResolutionService } from './conflict-resolution.service';
import { EntityMatcherService } from './entity-matcher.service';
import { ImportEngineController } from './import-engine.controller';
import { SyncRunsService } from './sync-runs.service';

@Module({
  imports: [AuthModule, CompetitionsModule, TeamsModule, PlayersModule, MatchesModule],
  controllers: [ImportEngineController],
  providers: [SyncRunsService, EntityMatcherService, ConflictResolutionService],
  exports: [EntityMatcherService],
})
export class ImportEngineModule {}
