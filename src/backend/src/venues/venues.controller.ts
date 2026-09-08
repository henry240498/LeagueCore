import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuesService } from './venues.service';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'venues');
const PHOTO_MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB -- una foto de estadio real pesa más que un retrato
const PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('venues')
@UseGuards(JwtAuthGuard)
export class VenuesController {
  constructor(private readonly service: VenuesService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVenueDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Estadio eliminado' };
  }

  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: PHOTO_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!PHOTO_MIME.includes(file.mimetype)) {
          cb(new BadRequestException('Formato de imagen no permitido (usar PNG, JPG o WEBP)'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhoto(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (file.size > PHOTO_MAX_SIZE_BYTES) {
      fs.unlink(file.path, () => {});
      throw new BadRequestException(`El archivo supera el tamaño máximo permitido (${Math.round(PHOTO_MAX_SIZE_BYTES / 1024 / 1024)} MB)`);
    }
    return this.service.setPhoto(id, `/uploads/venues/${file.filename}`);
  }
}
