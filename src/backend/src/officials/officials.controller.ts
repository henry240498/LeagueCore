import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { IsIn } from 'class-validator';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProvenanceService } from '../research/provenance.service';
import { CreateOfficialDto } from './dto/create-official.dto';
import { UpdateOfficialDto } from './dto/update-official.dto';
import { OfficialsService } from './officials.service';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'officials');
const PHOTO_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB, mismo límite que Jugadores/Login
const PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

class SetStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

@Controller('officials')
@UseGuards(JwtAuthGuard)
export class OfficialsController {
  constructor(
    private readonly service: OfficialsService,
    private readonly provenance: ProvenanceService,
  ) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('officialTypeId') officialTypeId?: string,
    @Query('nationality') nationality?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      search,
      officialTypeId: officialTypeId ? Number(officialTypeId) : undefined,
      nationality,
      status,
      sortBy,
      sortDir,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('check-duplicates')
  checkDuplicates(@Query('firstName') firstName?: string, @Query('lastName') lastName?: string) {
    return this.service.checkDuplicates(firstName ?? '', lastName ?? '');
  }

  @Get('nationalities')
  listNationalities() {
    return this.service.listNationalities();
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Get(':id/provenance')
  getProvenance(@Param('id', ParseIntPipe) id: number) {
    return this.provenance.listForEntity('official', id);
  }

  @Post()
  create(@Body() dto: CreateOfficialDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOfficialDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Oficial eliminado' };
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
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (file.size > PHOTO_MAX_SIZE_BYTES) {
      fs.unlink(file.path, () => {});
      throw new BadRequestException(
        `El archivo supera el tamaño máximo permitido (${Math.round(PHOTO_MAX_SIZE_BYTES / 1024 / 1024)} MB)`,
      );
    }
    const url = `/uploads/officials/${file.filename}`;
    return this.service.update(id, { photoUrl: url });
  }
}
