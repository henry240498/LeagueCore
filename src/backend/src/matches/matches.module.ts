import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParametersModule } from '../parameters/parameters.module';
import { MatchEventsService } from './match-events.service';
import { MatchParticipantsService } from './match-participants.service';
import { MatchStatsService } from './match-stats.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [AuthModule, ParametersModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchEventsService, MatchParticipantsService, MatchStatsService],
  // MatchEventsService/MatchParticipantsService exportados además de MatchesService desde
  // migration-engine/ (motor de migración histórica), que necesita cargar goles/tarjetas/penales/
  // alineaciones directamente -- antes sólo MatchesService salía de este módulo porque ningún otro
  // módulo externo necesitaba los demás.
  exports: [MatchesService, MatchEventsService, MatchParticipantsService],
})
export class MatchesModule {}
