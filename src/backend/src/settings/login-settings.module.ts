import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoginSettingsController } from './login-settings.controller';
import { LoginSettingsService } from './login-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [LoginSettingsController],
  providers: [LoginSettingsService],
})
export class LoginSettingsModule {}
