import { Module } from '@nestjs/common';
import { TacticsController } from './tactics.controller';
import { TacticsService } from './tactics.service';

@Module({
  controllers: [TacticsController],
  providers: [TacticsService],
  exports: [TacticsService],
})
export class TacticsModule {}
