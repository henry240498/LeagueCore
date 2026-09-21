// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';

@Module({
  controllers: [DevController],
})
export class DevModule {}
