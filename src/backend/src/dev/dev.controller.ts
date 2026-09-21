// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
import { Controller, Get, NotFoundException } from '@nestjs/common';
import { TEST_CREDENTIALS } from './test-credentials.fixtures';

/**
 * Expone la lista de credenciales de prueba para el panel oculto del login.
 *
 * Doble barrera para que NUNCA quede accesible en producción:
 *  1) DevModule sólo se importa cuando NODE_ENV !== 'production' (ver app.module.ts).
 *  2) Este endpoint responde 404 si por algún motivo llegara a estar montado en prod.
 */
@Controller('dev')
export class DevController {
  @Get('test-credentials')
  getTestCredentials() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return TEST_CREDENTIALS;
  }
}
