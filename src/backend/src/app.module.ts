import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { CoachesModule } from './coaches/coaches.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DatabaseModule } from './database/database.module';
// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
import { DevModule } from './dev/dev.module';
import { HealthController } from './health/health.controller';
import { ImportEngineModule } from './import-engine/import-engine.module';
import { InsightsModule } from './insights/insights.module';
import { MatchesModule } from './matches/matches.module';
import { MigrationEngineModule } from './migration-engine/migration-engine.module';
import { OfficialsModule } from './officials/officials.module';
import { OperationsModule } from './operations/operations.module';
import { ParametersModule } from './parameters/parameters.module';
import { PlayersModule } from './players/players.module';
import { ReportsModule } from './reports/reports.module';
import { ResearchModule } from './research/research.module';
import { SearchModule } from './search/search.module';
import { SeasonsModule } from './seasons/seasons.module';
import { ScoutingModule } from './scouting/scouting.module';
import { LoginSettingsModule } from './settings/login-settings.module';
import { StatsModule } from './stats/stats.module';
import { TacticsModule } from './tactics/tactics.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { VenuesModule } from './venues/venues.module';
import { VideoModule } from './video/video.module';
import { VideogameRatingsModule } from './videogame-ratings/videogame-ratings.module';

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    AuthModule,
    ClubsModule,
    UsersModule,
    LoginSettingsModule,
    CompetitionsModule,
    TeamsModule,
    PlayersModule,
    OfficialsModule,
    OperationsModule,
    SeasonsModule,
    ScoutingModule,
    CoachesModule,
    VenuesModule,
    MatchesModule,
    ParametersModule,
    StatsModule,
    TacticsModule,
    SearchModule,
    ImportEngineModule,
    InsightsModule,
    ResearchModule,
    MigrationEngineModule,
    VideogameRatingsModule,
    VideoModule,
    ReportsModule,
    // DEV-ONLY: herramientas de desarrollo (panel de credenciales de prueba).
    // No se monta en producción. Quitar antes de release: docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
    ...(process.env.NODE_ENV === 'production' ? [] : [DevModule]),
  ],
  controllers: [HealthController, DashboardController],
})
export class AppModule {}
