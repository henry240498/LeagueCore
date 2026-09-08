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
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

class SetStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

const LOGO_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'teams');
const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('competitionId') competitionId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.service.list({
      search,
      status,
      competitionId: competitionId ? Number(competitionId) : undefined,
      sortBy,
      sortDir,
    });
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Get(':id/roster-history')
  getRosterHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRosterHistory(id);
  }

  @Get(':id/competitions-history')
  getCompetitionsHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCompetitionsHistory(id);
  }

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: LOGO_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: LOGO_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!LOGO_MIME.includes(file.mimetype)) {
          cb(new BadRequestException('Formato de imagen no permitido (usar PNG, JPG, WEBP o SVG)'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (file.size > LOGO_MAX_SIZE_BYTES) {
      fs.unlink(file.path, () => {});
      throw new BadRequestException(`El archivo supera el tamaño máximo permitido (${Math.round(LOGO_MAX_SIZE_BYTES / 1024 / 1024)} MB)`);
    }
    return this.service.update(id, { logoUrl: `/uploads/teams/${file.filename}` } as any);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Equipo eliminado' };
  }
}
