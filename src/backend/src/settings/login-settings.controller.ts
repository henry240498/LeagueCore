import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as sql from 'mssql';
import { diskStorage } from 'multer';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SQL_POOL } from '../database/database.module';
import { UpdateLoginSettingsDto } from './dto/update-login-settings.dto';
import { LoginSettingsService } from './login-settings.service';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'login');
const IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const VIDEO_MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB — suficiente para un clip corto de fondo
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const VIDEO_MIME = ['video/mp4', 'video/webm'];

const ALLOWED_FIELDS = ['logoMain', 'logoLogin', 'backgroundImage', 'backgroundVideo'] as const;
type MediaField = (typeof ALLOWED_FIELDS)[number];

const FIELD_TO_DTO_KEY: Record<
  MediaField,
  'logoMainUrl' | 'logoLoginUrl' | 'backgroundImageUrl' | 'backgroundVideoUrl'
> = {
  logoMain: 'logoMainUrl',
  logoLogin: 'logoLoginUrl',
  backgroundImage: 'backgroundImageUrl',
  backgroundVideo: 'backgroundVideoUrl',
};

const VIDEO_FIELDS: MediaField[] = ['backgroundVideo'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function audit(pool: sql.ConnectionPool, userId: number, action: string, details?: string) {
  await pool
    .request()
    .input('user_id', sql.Int, userId)
    .input('action', sql.NVarChar, action)
    .input('details', sql.NVarChar, details ?? null)
    .query(
      `INSERT INTO dbo.audit_log (user_id, action, details) VALUES (@user_id, @action, @details)`,
    );
}

@Controller('settings/login')
export class LoginSettingsController {
  constructor(
    private readonly settingsService: LoginSettingsService,
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
  ) {}

  // Público: la propia página de login (sin sesión) necesita esto para pintarse.
  @Get()
  async get() {
    return this.settingsService.get();
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async update(@Body() dto: UpdateLoginSettingsDto, @Req() req: AuthenticatedRequest) {
    const result = await this.settingsService.update(dto, req.user!.id);
    await audit(this.pool, req.user!.id, 'update_login_settings');
    return result;
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async reset(@Req() req: AuthenticatedRequest) {
    const result = await this.settingsService.reset(req.user!.id);
    await audit(this.pool, req.user!.id, 'reset_login_settings');
    return result;
  }

  @Post('upload/:field')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
      // El límite global tiene que cubrir el caso más grande (video); el tamaño de imagen
      // se revisa aparte, después de subir, porque multer no conoce el tamaño final todavía
      // en el momento de fileFilter (recién terminó de leer los headers de la parte).
      limits: { fileSize: VIDEO_MAX_SIZE_BYTES },
      fileFilter: (req, file, cb) => {
        const field = (req.params as Record<string, string>).field as MediaField;
        const isVideo = VIDEO_FIELDS.includes(field);
        const allowed = isVideo ? VIDEO_MIME : IMAGE_MIME;
        if (!allowed.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              isVideo
                ? 'Formato de video no permitido (usar MP4 o WEBM)'
                : 'Formato de imagen no permitido (usar PNG, JPG, WEBP o SVG)',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @Param('field') field: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!ALLOWED_FIELDS.includes(field as MediaField)) {
      throw new BadRequestException('Campo de archivo inválido');
    }
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    const isVideo = VIDEO_FIELDS.includes(field as MediaField);
    const maxSize = isVideo ? VIDEO_MAX_SIZE_BYTES : IMAGE_MAX_SIZE_BYTES;
    if (file.size > maxSize) {
      fs.unlink(file.path, () => {});
      throw new BadRequestException(
        `El archivo supera el tamaño máximo permitido (${Math.round(maxSize / 1024 / 1024)} MB)`,
      );
    }

    const url = `/uploads/login/${file.filename}`;
    const dtoKey = FIELD_TO_DTO_KEY[field as MediaField];
    let result = await this.settingsService.setImage(dtoKey, url, req.user!.id);

    // Un video nuevo invalida cualquier recorte anterior (podía ser más largo que el video nuevo).
    if (isVideo) {
      result = await this.settingsService.update(
        { backgroundVideoStartSeconds: null, backgroundVideoEndSeconds: null },
        req.user!.id,
      );
    }

    await audit(this.pool, req.user!.id, 'update_login_settings', `archivo: ${field}`);
    return result;
  }
}
