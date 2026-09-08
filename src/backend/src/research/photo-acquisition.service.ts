import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PHOTO_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};
const MAX_BYTES = 2 * 1024 * 1024; // mismo límite que la subida manual (players/officials/teams)
const FETCH_TIMEOUT_MS = 15000;

// Descarga y valida una foto encontrada durante la investigación, reusando la misma estructura de
// almacenamiento que "Subir foto" ya usa manualmente (uploads/<kind>/<uuid>.<ext>) -- nunca guarda
// sólo la URL externa (pedido explícito, Parte 5/13 del pedido de investigación real).
@Injectable()
export class PhotoAcquisitionService {
  private readonly logger = new Logger(PhotoAcquisitionService.name);

  async acquire(kind: 'players' | 'officials', sourceUrl: string): Promise<string | null> {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

      const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        this.logger.warn(`Foto no descargable (${res.status}): ${sourceUrl}`);
        return null;
      }
      const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
      const ext = PHOTO_MIME[contentType];
      if (!ext) {
        this.logger.warn(`Formato de imagen no permitido (${contentType || 'desconocido'}): ${sourceUrl}`);
        return null;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
        this.logger.warn(`Foto fuera de rango de tamaño (${buffer.byteLength} bytes): ${sourceUrl}`);
        return null;
      }

      const dir = path.join(process.cwd(), 'uploads', kind);
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${crypto.randomUUID()}${ext}`;
      fs.writeFileSync(path.join(dir, filename), buffer);
      return `/uploads/${kind}/${filename}`;
    } catch (err: any) {
      this.logger.warn(`No se pudo obtener la foto (${sourceUrl}): ${err?.message ?? err}`);
      return null;
    }
  }
}
