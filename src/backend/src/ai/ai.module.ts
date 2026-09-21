import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InsightsModule } from '../insights/insights.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AuthModule, InsightsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
