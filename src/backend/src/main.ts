import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from './app.module';
import { resolveJwtSecret } from './auth/auth.service';

async function bootstrap() {
  // Falla temprano (al arrancar, no en el primer login) si falta JWT_SECRET en producción.
  resolveJwtSecret();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cabeceras de seguridad. `crossOriginResourcePolicy` se relaja porque /uploads sirve imágenes
  // que consume el frontend desde otro origen en desarrollo.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4001;
  await app.listen(port);
  console.log(`LeagueCore API escuchando en http://localhost:${port}/api/v1`);
}

bootstrap();
