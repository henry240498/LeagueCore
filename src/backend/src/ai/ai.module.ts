import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [InsightsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
