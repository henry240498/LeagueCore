import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParametersController } from './parameters.controller';
import { ParametersService } from './parameters.service';

@Module({
  imports: [AuthModule],
  controllers: [ParametersController],
  providers: [ParametersService],
  exports: [ParametersService],
})
export class ParametersModule {}
