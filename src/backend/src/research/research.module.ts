import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { SyncRunsService } from '../import-engine/sync-runs.service';
import { OfficialsModule } from '../officials/officials.module';
import { PlayersModule } from '../players/players.module';
import { SeasonsModule } from '../seasons/seasons.module';
import { TeamsModule } from '../teams/teams.module';
import { OfficialResearchService } from './official-research.service';
import { PhotoAcquisitionService } from './photo-acquisition.service';
import { PlayerResearchService } from './player-research.service';
import { ProvenanceService } from './provenance.service';
import { ResearchController } from './research.controller';

// Reusa SyncRunTracker/SyncRunsService del motor genérico ya construido (sync_runs y tablas
// asociadas) en vez de duplicarlo -- decisión explícita de esta pasada: priorizar la investigación
// real funcionando por sobre el renombre cosmético sync_*->research_* propuesto en la arquitectura.
@Module({
  imports: [AuthModule, PlayersModule, OfficialsModule, TeamsModule, CompetitionsModule, SeasonsModule],
  controllers: [ResearchController],
  providers: [SyncRunTracker, SyncRunsService, PlayerResearchService, OfficialResearchService, PhotoAcquisitionService, ProvenanceService],
})
export class ResearchModule {}
