import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InformalTournamentsController } from './informal-tournaments.controller';
import { InformalTournamentsService } from './informal-tournaments.service';

@Module({
  imports: [AuthModule],
  controllers: [InformalTournamentsController],
  providers: [InformalTournamentsService],
  exports: [InformalTournamentsService],
})
export class InformalTournamentsModule {}
