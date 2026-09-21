import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  imports: [AuthModule],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
