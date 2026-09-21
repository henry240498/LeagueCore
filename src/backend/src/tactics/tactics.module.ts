import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TacticsController } from './tactics.controller';
import { TacticsService } from './tactics.service';

@Module({
  imports: [AuthModule],
  controllers: [TacticsController],
  providers: [TacticsService],
  exports: [TacticsService],
})
export class TacticsModule {}
