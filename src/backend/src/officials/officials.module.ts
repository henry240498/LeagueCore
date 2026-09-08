import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvenanceService } from '../research/provenance.service';
import { OfficialTypesController } from './official-types.controller';
import { OfficialTypesService } from './official-types.service';
import { OfficialsController } from './officials.controller';
import { OfficialsService } from './officials.service';

@Module({
  imports: [AuthModule],
  controllers: [OfficialsController, OfficialTypesController],
  providers: [OfficialsService, OfficialTypesService, ProvenanceService],
  exports: [OfficialsService, OfficialTypesService],
})
export class OfficialsModule {}
