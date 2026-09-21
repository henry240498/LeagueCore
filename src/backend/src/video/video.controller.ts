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
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateClipDto, CreateMarkerDto, CreateTagDto, CreateVideoDto, UpdateVideoDto } from './dto/video.dto';
import { VideoService } from './video.service';

const VIDEO_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'videos');
const VIDEO_MAX_SIZE_BYTES = 500 * 1024 * 1024;
const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];

fs.mkdirSync(VIDEO_UPLOAD_DIR, { recursive: true });

@Controller('video')
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private readonly service: VideoService) {}

  @Get('videos')
  listVideos(@Query('matchId') matchId?: string) {
    return this.service.listVideos(matchId ? Number(matchId) : undefined);
  }

  @Post('videos')
  createVideo(@Body() dto: CreateVideoDto) {
    return this.service.createVideo(dto);
  }

  @Get('videos/:id')
  getVideo(@Param('id', ParseIntPipe) id: number) {
    return this.service.getVideo(id);
  }

  @Put('videos/:id')
  updateVideo(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVideoDto) {
    return this.service.updateVideo(id, dto);
  }

  @Delete('videos/:id')
  async removeVideo(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeVideo(id);
    return { message: 'Video eliminado' };
  }

  @Post('videos/:id/file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: VIDEO_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${crypto.randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: VIDEO_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!VIDEO_MIME.includes(file.mimetype)) {
          cb(new BadRequestException('Formato no permitido (usar MP4, WEBM o MOV)'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.service.updateVideo(id, { videoUrl: `/uploads/videos/${file.filename}` } as any);
  }

  @Get('tags')
  listTags() {
    return this.service.listTags();
  }

  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.service.createTag(dto);
  }

  @Delete('tags/:id')
  async removeTag(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeTag(id);
    return { message: 'Etiqueta eliminada' };
  }

  @Get('videos/:id/markers')
  listMarkers(@Param('id', ParseIntPipe) id: number) {
    return this.service.listMarkers(id);
  }

  @Post('videos/:id/markers')
  createMarker(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateMarkerDto) {
    return this.service.createMarker(id, dto);
  }

  @Patch('videos/:videoId/markers/:markerId/favorite')
  async toggleFavorite(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('markerId', ParseIntPipe) markerId: number,
  ) {
    await this.service.toggleFavorite(videoId, markerId);
    return { message: 'Favorito actualizado' };
  }

  @Delete('videos/:videoId/markers/:markerId')
  async removeMarker(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('markerId', ParseIntPipe) markerId: number,
  ) {
    await this.service.removeMarker(videoId, markerId);
    return { message: 'Marcador eliminado' };
  }

  @Get('videos/:id/clips')
  listClips(@Param('id', ParseIntPipe) id: number) {
    return this.service.listClips(id);
  }

  @Post('videos/:id/clips')
  createClip(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateClipDto) {
    return this.service.createClip(id, dto);
  }

  @Delete('videos/:videoId/clips/:clipId')
  async removeClip(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('clipId', ParseIntPipe) clipId: number,
  ) {
    await this.service.removeClip(videoId, clipId);
    return { message: 'Clip eliminado' };
  }

  @Get('matches/:matchId/sync')
  getSyncTimeline(@Param('matchId', ParseIntPipe) matchId: number, @Query('videoId') videoId?: string) {
    const id = Number(videoId);
    // Sin videoId válido daba un 404 "Video no encontrado" engañoso: es un parámetro obligatorio.
    if (!videoId || !Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('videoId es obligatorio (?videoId=<id del video>)');
    }
    return this.service.getSyncTimeline(matchId, id);
  }
}
