import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CoachesModule } from './coaches/coaches.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { DashboardController } from './dashboard/dashboard.controller';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ImportEngineModule } from './import-engine/import-engine.module';
import { MatchesModule } from './matches/matches.module';
import { MigrationEngineModule } from './migration-engine/migration-engine.module';
import { OfficialsModule } from './officials/officials.module';
import { ParametersModule } from './parameters/parameters.module';
import { PlayersModule } from './players/players.module';
import { ReportsModule } from './reports/reports.module';
import { ResearchModule } from './research/research.module';
import { SearchModule } from './search/search.module';
import { SeasonsModule } from './seasons/seasons.module';
import { LoginSettingsModule } from './settings/login-settings.module';
import { StatsModule } from './stats/stats.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { VenuesModule } from './venues/venues.module';
import { VideogameRatingsModule } from './videogame-ratings/videogame-ratings.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    LoginSettingsModule,
    CompetitionsModule,
    TeamsModule,
    PlayersModule,
    OfficialsModule,
    SeasonsModule,
    CoachesModule,
    VenuesModule,
    MatchesModule,
    ParametersModule,
    StatsModule,
    SearchModule,
    ImportEngineModule,
    ResearchModule,
    MigrationEngineModule,
    VideogameRatingsModule,
    ReportsModule,
  ],
  controllers: [HealthController, DashboardController],
})
export class AppModule {}
