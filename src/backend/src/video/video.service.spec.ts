import { BadRequestException } from '@nestjs/common';
import { formatTimestamp, minuteToSeconds, VideoService } from './video.service';

describe('minuteToSeconds / formatTimestamp', () => {
  it('convierte minuto a segundos con offset', () => {
    expect(minuteToSeconds(37, 2, 0)).toBe(37 * 60 + 120);
    expect(minuteToSeconds(37, null, 10)).toBe(37 * 60 + 10);
    expect(minuteToSeconds(null, null, 0)).toBeNull();
  });

  it('formatea 37:42 como mm:ss y horas cuando corresponde', () => {
    expect(formatTimestamp(37 * 60 + 42)).toBe('37:42');
    expect(formatTimestamp(14 * 60 + 32)).toBe('14:32');
    expect(formatTimestamp(3600 + 62)).toBe('1:01:02');
  });
});

describe('VideoService - clips', () => {
  function createMockPool() {
    const clips: any[] = [];
    let nextId = 1;
    const request = () => {
      const inputs: Record<string, any> = {};
      const req: any = {
        input(name: string, ...rest: any[]) {
          inputs[name] = rest.length > 1 ? rest[1] : rest[0];
          return req;
        },
        async query(sqlText: string) {
          const q = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
          if (q.startsWith('select * from dbo.match_videos where id = @id')) {
            return { recordset: inputs.id === 1 ? [{ id: 1, offset_seconds: 0 }] : [] };
          }
          if (q.startsWith('insert into dbo.video_clips')) {
            const row: any = { id: nextId++ };
            for (const [k, v] of Object.entries(inputs)) row[k] = v;
            clips.push(row);
            return { recordset: [{ id: row.id }] };
          }
          return { recordset: [] };
        },
      };
      return req;
    };
    return { request };
  }

  it('crea un clip válido', async () => {
    const service = new VideoService(createMockPool() as any);
    const created = await service.createClip(1, { title: 'Gol', startSeconds: 872, endSeconds: 900 } as any);
    expect(created.id).toBe(1);
  });

  it('rechaza un clip con fin anterior al inicio', async () => {
    const service = new VideoService(createMockPool() as any);
    await expect(
      service.createClip(1, { title: 'Mal', startSeconds: 900, endSeconds: 800 } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
