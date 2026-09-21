import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScoutingController } from './scouting.controller';
import { ScoutingService } from './scouting.service';

@Module({
  imports: [AuthModule],
  controllers: [ScoutingController],
  providers: [ScoutingService],
  exports: [ScoutingService],
})
export class ScoutingModule {}
