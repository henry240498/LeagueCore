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
import { CreatePhysicalRecordDto } from './dto/create-physical-record.dto';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreateInjuryDto, UpdateInjuryDto } from './dto/injury.dto';
import { SaveTechnicalRatingsDto } from './dto/save-technical-ratings.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayersService } from './players.service';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'players');
const PHOTO_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB, igual límite que las imágenes de Login
const PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp'];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

class SetStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(
    private readonly service: PlayersService,
    private readonly provenance: ProvenanceService,
  ) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('teamId') teamId?: string,
    @Query('competitionId') competitionId?: string,
    @Query('position') position?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      search,
      teamId: teamId ? Number(teamId) : undefined,
      competitionId: competitionId ? Number(competitionId) : undefined,
      position,
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

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  // Procedencia real por campo (Decisión 3: "no quiero una única fuente para toda la entidad") --
  // qué fuente dijo qué valor y cuándo, más los identificadores externos conocidos de este jugador.
  @Get(':id/provenance')
  getProvenance(@Param('id', ParseIntPipe) id: number) {
    return this.provenance.listForEntity('player', id);
  }

  @Get(':id/positions')
  listPositions(@Param('id', ParseIntPipe) id: number) {
    return this.service.listPositions(id);
  }

  // Expediente avanzado (Fase 2): perfil fisico, tecnico 1-100 y lesiones.
  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProfile(id);
  }

  @Get(':id/physical')
  listPhysical(@Param('id', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    return this.service.listPhysical(id, limit ? Number(limit) : undefined);
  }

  @Post(':id/physical')
  addPhysical(@Param('id', ParseIntPipe) id: number, @Body() dto: CreatePhysicalRecordDto) {
    return this.service.addPhysical(id, dto);
  }

  @Get(':id/technical')
  getTechnical(@Param('id', ParseIntPipe) id: number) {
    return this.service.getTechnical(id);
  }

  @Put(':id/technical')
  saveTechnical(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveTechnicalRatingsDto) {
    return this.service.saveTechnical(id, dto);
  }

  @Get(':id/injuries')
  listInjuries(@Param('id', ParseIntPipe) id: number) {
    return this.service.listInjuries(id);
  }

  @Post(':id/injuries')
  addInjury(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateInjuryDto) {
    return this.service.addInjury(id, dto);
  }

  @Put(':id/injuries/:injuryId')
  updateInjury(
    @Param('id', ParseIntPipe) id: number,
    @Param('injuryId', ParseIntPipe) injuryId: number,
    @Body() dto: UpdateInjuryDto,
  ) {
    return this.service.updateInjury(id, injuryId, dto);
  }

  @Delete(':id/injuries/:injuryId')
  async removeInjury(
    @Param('id', ParseIntPipe) id: number,
    @Param('injuryId', ParseIntPipe) injuryId: number,
  ) {
    await this.service.removeInjury(id, injuryId);
    return { message: 'Lesión eliminada' };
  }

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlayerDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetStatusDto) {
    return this.service.setStatus(id, dto.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Jugador eliminado' };
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
    const url = `/uploads/players/${file.filename}`;
    return this.service.update(id, { photoUrl: url });
  }
}
