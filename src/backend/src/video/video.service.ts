import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CreateClipDto, CreateMarkerDto, CreateTagDto, CreateVideoDto, UpdateVideoDto } from './dto/video.dto';

export function minuteToSeconds(minute: number | null, extra: number | null, offset: number): number | null {
  if (minute === null || minute === undefined) return null;
  return minute * 60 + (extra ?? 0) * 60 + offset;
}

export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

@Injectable()
export class VideoService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // ---------- Videos ----------
  async listVideos(matchId?: number) {
    const request = this.pool.request();
    const where = matchId ? 'WHERE v.match_id = @match_id' : '';
    if (matchId) request.input('match_id', sql.Int, matchId);
    const result = await request.query(
      `SELECT v.*, m.home_team_id, m.away_team_id,
        (SELECT COUNT(*) FROM dbo.video_markers k WHERE k.video_id = v.id) AS markers_count,
        (SELECT COUNT(*) FROM dbo.video_clips c WHERE c.video_id = v.id) AS clips_count
       FROM dbo.match_videos v LEFT JOIN dbo.matches m ON m.id = v.match_id ${where} ORDER BY v.created_at DESC`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      matchId: r.match_id,
      title: r.title,
      kind: r.kind,
      videoUrl: r.video_url,
      durationSeconds: r.duration_seconds,
      offsetSeconds: r.offset_seconds,
      recordedAt: r.recorded_at,
      markersCount: r.markers_count,
      clipsCount: r.clips_count,
    }));
  }

  async getVideo(id: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.match_videos WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Video no encontrado');
    const r = result.recordset[0];
    return {
      id: r.id,
      matchId: r.match_id,
      title: r.title,
      kind: r.kind,
      videoUrl: r.video_url,
      durationSeconds: r.duration_seconds,
      offsetSeconds: r.offset_seconds,
      recordedAt: r.recorded_at,
    };
  }

  async createVideo(dto: CreateVideoDto) {
    if (dto.matchId) await this.assertMatchExists(dto.matchId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, dto.matchId ?? null)
      .input('title', sql.NVarChar, dto.title)
      .input('kind', sql.NVarChar, dto.kind ?? 'PARTIDO_COMPLETO')
      .input('video_url', sql.NVarChar, dto.videoUrl ?? null)
      .input('duration_seconds', sql.Int, dto.durationSeconds ?? null)
      .input('offset_seconds', sql.Int, dto.offsetSeconds ?? 0)
      .input('recorded_at', sql.Date, dto.recordedAt ?? null)
      .query(
        `INSERT INTO dbo.match_videos (match_id, title, kind, video_url, duration_seconds, offset_seconds, recorded_at)
         OUTPUT INSERTED.id VALUES (@match_id, @title, @kind, @video_url, @duration_seconds, @offset_seconds, @recorded_at)`,
      );
    return this.getVideo(result.recordset[0].id);
  }

  async updateVideo(id: number, dto: UpdateVideoDto) {
    await this.getVideo(id);
    if (dto.matchId) await this.assertMatchExists(dto.matchId);
    const map: Record<string, string> = {
      matchId: 'match_id',
      title: 'title',
      kind: 'kind',
      videoUrl: 'video_url',
      durationSeconds: 'duration_seconds',
      offsetSeconds: 'offset_seconds',
      recordedAt: 'recorded_at',
    };
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      const request = this.pool.request();
      const sets: string[] = [];
      for (const [camel, value] of entries) {
        const column = map[camel];
        if (!column) continue;
        request.input(column, value);
        sets.push(`${column} = @${column}`);
      }
      sets.push('updated_at = SYSUTCDATETIME()');
      request.input('id', sql.Int, id);
      await request.query(`UPDATE dbo.match_videos SET ${sets.join(', ')} WHERE id = @id`);
    }
    return this.getVideo(id);
  }

  async removeVideo(id: number) {
    await this.getVideo(id);
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.match_videos WHERE id = @id');
  }

  // ---------- Etiquetas ----------
  async listTags() {
    const result = await this.pool.query('SELECT * FROM dbo.video_tags ORDER BY label');
    return result.recordset.map((r) => ({ id: r.id, code: r.code, label: r.label }));
  }

  async createTag(dto: CreateTagDto) {
    try {
      const result = await this.pool
        .request()
        .input('code', sql.NVarChar, dto.code)
        .input('label', sql.NVarChar, dto.label)
        .query('INSERT INTO dbo.video_tags (code, label) OUTPUT INSERTED.id VALUES (@code, @label)');
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2601 || err?.number === 2627) {
        throw new BadRequestException('Ya existe una etiqueta con ese código');
      }
      throw err;
    }
  }

  async removeTag(id: number) {
    try {
      await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.video_tags WHERE id = @id');
    } catch (err: any) {
      if (err?.number === 547) {
        throw new BadRequestException('No se puede eliminar: hay marcadores usando esta etiqueta');
      }
      throw err;
    }
  }

  // ---------- Marcadores ----------
  async listMarkers(videoId: number) {
    await this.getVideo(videoId);
    const result = await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .query(
        `SELECT k.*, t.label AS tag_label FROM dbo.video_markers k
         LEFT JOIN dbo.video_tags t ON t.code = k.tag_code
         WHERE k.video_id = @video_id ORDER BY k.time_seconds, k.id`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      videoId: r.video_id,
      timeSeconds: r.time_seconds,
      timestamp: formatTimestamp(r.time_seconds),
      tagCode: r.tag_code,
      tagLabel: r.tag_label,
      eventSource: r.event_source,
      eventId: r.event_id,
      note: r.note,
      favorite: !!r.favorite,
    }));
  }

  async createMarker(videoId: number, dto: CreateMarkerDto) {
    await this.getVideo(videoId);
    const result = await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .input('time_seconds', sql.Int, dto.timeSeconds)
      .input('tag_code', sql.NVarChar, dto.tagCode ?? null)
      .input('event_source', sql.NVarChar, dto.eventSource ?? null)
      .input('event_id', sql.Int, dto.eventId ?? null)
      .input('note', sql.NVarChar, dto.note ?? null)
      .input('favorite', sql.Bit, dto.favorite ?? false)
      .query(
        `INSERT INTO dbo.video_markers (video_id, time_seconds, tag_code, event_source, event_id, note, favorite)
         OUTPUT INSERTED.id VALUES (@video_id, @time_seconds, @tag_code, @event_source, @event_id, @note, @favorite)`,
      );
    return { id: result.recordset[0].id };
  }

  async toggleFavorite(videoId: number, markerId: number) {
    const result = await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .input('id', sql.Int, markerId)
      .query('SELECT favorite FROM dbo.video_markers WHERE id = @id AND video_id = @video_id');
    if (result.recordset.length === 0) throw new NotFoundException('Marcador no encontrado');
    await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .input('id', sql.Int, markerId)
      .query('UPDATE dbo.video_markers SET favorite = 1 - favorite WHERE id = @id AND video_id = @video_id');
  }

  async removeMarker(videoId: number, markerId: number) {
    await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .input('id', sql.Int, markerId)
      .query('DELETE FROM dbo.video_markers WHERE id = @id AND video_id = @video_id');
  }

  // ---------- Clips ----------
  async listClips(videoId: number) {
    await this.getVideo(videoId);
    const result = await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .query('SELECT * FROM dbo.video_clips WHERE video_id = @video_id ORDER BY start_seconds');
    return result.recordset.map((r) => ({
      id: r.id,
      videoId: r.video_id,
      title: r.title,
      startSeconds: r.start_seconds,
      endSeconds: r.end_seconds,
      startTimestamp: formatTimestamp(r.start_seconds),
      endTimestamp: formatTimestamp(r.end_seconds),
      description: r.description,
    }));
  }

  async createClip(videoId: number, dto: CreateClipDto) {
    await this.getVideo(videoId);
    if (dto.endSeconds <= dto.startSeconds) {
      throw new BadRequestException('El fin del clip debe ser posterior al inicio');
    }
    const result = await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .input('title', sql.NVarChar, dto.title)
      .input('start_seconds', sql.Int, dto.startSeconds)
      .input('end_seconds', sql.Int, dto.endSeconds)
      .input('description', sql.NVarChar, dto.description ?? null)
      .query(
        `INSERT INTO dbo.video_clips (video_id, title, start_seconds, end_seconds, description)
         OUTPUT INSERTED.id VALUES (@video_id, @title, @start_seconds, @end_seconds, @description)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeClip(videoId: number, clipId: number) {
    await this.pool
      .request()
      .input('video_id', sql.Int, videoId)
      .input('id', sql.Int, clipId)
      .query('DELETE FROM dbo.video_clips WHERE id = @id AND video_id = @video_id');
  }

  // ---------- Sync evento <-> video ----------
  // Une marcadores del video con TODOS los eventos reales del partido mapeados a segundos.
  async getSyncTimeline(matchId: number, videoId: number) {
    const video = await this.getVideo(videoId);
    const offset = video.offsetSeconds ?? 0;
    const req = () => this.pool.request().input('match_id', sql.Int, matchId);
    const items: { timeSeconds: number | null; timestamp: string | null; kind: string; label: string; ref: string }[] = [];

    const goals = await req().query(
      `SELECT g.id, g.minute, g.minute_extra, p.full_name, t.name AS team_name FROM dbo.goals g
       JOIN dbo.players p ON p.id = g.player_id JOIN dbo.teams t ON t.id = g.team_id WHERE g.match_id = @match_id`,
    );
    for (const r of goals.recordset) {
      const s = minuteToSeconds(r.minute, r.minute_extra, offset);
      items.push({ timeSeconds: s, timestamp: s === null ? null : formatTimestamp(s), kind: 'goal', label: `⚽ Gol ${r.full_name} (${r.team_name})`, ref: `goal:${r.id}` });
    }
    const shots = await req().query(
      `SELECT s.id, s.minute, s.minute_extra, p.full_name FROM dbo.shots s
       JOIN dbo.players p ON p.id = s.player_id WHERE s.match_id = @match_id`,
    );
    for (const r of shots.recordset) {
      const s = minuteToSeconds(r.minute, r.minute_extra, offset);
      items.push({ timeSeconds: s, timestamp: s === null ? null : formatTimestamp(s), kind: 'shot', label: `🎯 Tiro ${r.full_name}`, ref: `shot:${r.id}` });
    }
    const cards = await req().query(
      `SELECT c.id, c.minute, c.minute_extra, c.card_type, p.full_name FROM dbo.cards c
       JOIN dbo.players p ON p.id = c.player_id WHERE c.match_id = @match_id`,
    );
    for (const r of cards.recordset) {
      const s = minuteToSeconds(r.minute, r.minute_extra, offset);
      items.push({ timeSeconds: s, timestamp: s === null ? null : formatTimestamp(s), kind: 'card', label: `🟨 ${r.card_type} ${r.full_name}`, ref: `card:${r.id}` });
    }
    const subs = await req().query(`SELECT id, minute, minute_extra FROM dbo.substitutions WHERE match_id = @match_id`);
    for (const r of subs.recordset) {
      const s = minuteToSeconds(r.minute, r.minute_extra, offset);
      items.push({ timeSeconds: s, timestamp: s === null ? null : formatTimestamp(s), kind: 'substitution', label: '🔄 Cambio', ref: `substitution:${r.id}` });
    }
    const custom = await req().query(
      `SELECT e.id, e.minute, et.label FROM dbo.match_custom_events e
       JOIN dbo.custom_event_types et ON et.code = e.event_code WHERE e.match_id = @match_id`,
    );
    for (const r of custom.recordset) {
      const s = minuteToSeconds(r.minute, null, offset);
      items.push({ timeSeconds: s, timestamp: s === null ? null : formatTimestamp(s), kind: 'custom', label: `🏷️ ${r.label}`, ref: `custom:${r.id}` });
    }
    const markers = await this.listMarkers(videoId);
    for (const m of markers) {
      items.push({ timeSeconds: m.timeSeconds, timestamp: m.timestamp, kind: 'marker', label: `📌 ${m.tagLabel ?? m.note ?? 'Marcador'}`, ref: `marker:${m.id}` });
    }

    items.sort((a, b) => (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0));
    return { video, items };
  }

  private async assertMatchExists(matchId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, matchId)
      .query('SELECT TOP 1 1 FROM dbo.matches WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('El partido indicado no existe');
  }
}
