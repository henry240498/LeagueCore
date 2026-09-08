import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachesModule } from '../coaches/coaches.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { EntityMatcherService } from '../import-engine/entity-matcher.service';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { SyncRunsService } from '../import-engine/sync-runs.service';
import { MatchesModule } from '../matches/matches.module';
import { OfficialsModule } from '../officials/officials.module';
import { PlayersModule } from '../players/players.module';
import { ProvenanceService } from '../research/provenance.service';
import { SeasonsModule } from '../seasons/seasons.module';
import { TeamsModule } from '../teams/teams.module';
import { VenuesModule } from '../venues/venues.module';
import { CommitService } from './commit.service';
import { MigrationEngineController } from './migration-engine.controller';
import { MigrationMatcherService } from './migration-matcher.service';
import { NormalizationService } from './normalization.service';
import { PipelineRunnerService } from './pipeline-runner.service';
import { ReconciliationService } from './reconciliation.service';
import { StagingRepository } from './staging.repository';
import { ValidationService } from './validation.service';

// Motor de migración histórica (Registro Fútbol → LeagueCore, ver plan técnico aprobado).
// Reutiliza SyncRunTracker/SyncRunsService/ProvenanceService/EntityMatcherService tal cual desde los
// motores existentes (regla explícita del cliente: "NO CREAR UN SEGUNDO MOTOR") -- lo único
// realmente nuevo acá es la cola de staging y las etapas que le faltaban al pipeline (ver
// docs/ANALISIS_REGISTRO_FUTBOL_VS_LEAGUECORE.md y el plan).
@Module({
  imports: [AuthModule, CompetitionsModule, TeamsModule, SeasonsModule, VenuesModule, PlayersModule, OfficialsModule, CoachesModule, MatchesModule],
  controllers: [MigrationEngineController],
  providers: [
    SyncRunTracker,
    SyncRunsService,
    EntityMatcherService,
    ProvenanceService,
    StagingRepository,
    NormalizationService,
    MigrationMatcherService,
    ReconciliationService,
    ValidationService,
    CommitService,
    PipelineRunnerService,
  ],
})
export class MigrationEngineModule {}
