// DEV-ONLY: quitar antes de release. Ver docs/DEV_TOOLS_QUITAR_ANTES_DE_RELEASE.md
import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TEST_CREDENTIALS } from './test-credentials.fixtures';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Cabeceras que agregan Cloudflare (túnel) y cualquier proxy inverso. Un acceso local
// directo (navegador en esta PC -> localhost) no las trae.
const PROXY_HEADERS = [
  'cf-connecting-ip',
  'cf-ray',
  'cf-visitor',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
  'forwarded',
];

/** true si la petición viene de esta misma PC y NO pasó por el túnel ni por un proxy. */
export function isLocalRequest(req: Pick<Request, 'socket' | 'headers'>): boolean {
  if (!LOOPBACK.has(req.socket?.remoteAddress ?? '')) return false;
  return !PROXY_HEADERS.some((h) => req.headers[h] !== undefined);
}

/**
 * Expone la lista de credenciales de prueba para el panel oculto del login.
 *
 * Barreras para que NUNCA quede accesible donde no debe:
 *  1) DevModule sólo se importa cuando NODE_ENV !== 'production' (ver app.module.ts).
 *  2) Responde 404 si NODE_ENV === 'production'.
 *  3) Sólo responde a accesos LOCALES. Como el túnel de Cloudflare arranca junto con la app,
 *     cualquiera con la URL pública llegaría a este endpoint; por eso una petición que pasó
 *     por el túnel (o por cualquier proxy) recibe 404. Para permitirlo a propósito
 *     (p. ej. probar desde el celular), definir DEV_CREDENTIALS_REMOTE=true en src/backend/.env.
 */
@Controller('dev')
export class DevController {
  @Get('test-credentials')
  getTestCredentials(@Req() req: Request) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    if (process.env.DEV_CREDENTIALS_REMOTE !== 'true' && !isLocalRequest(req)) {
      throw new NotFoundException();
    }
    return TEST_CREDENTIALS;
  }
}
