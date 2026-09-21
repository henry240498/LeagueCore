import { BadRequestException } from '@nestjs/common';
import { VideoController } from './video.controller';

// GET /video/matches/:matchId/sync exige ?videoId. Sin él respondía un 404 "Video no encontrado" engañoso.
describe('VideoController.getSyncTimeline', () => {
  const service = { getSyncTimeline: jest.fn().mockResolvedValue({ items: [] }) };
  const controller = new VideoController(service as any);

  beforeEach(() => service.getSyncTimeline.mockClear());

  it.each([undefined, '', 'abc', '0', '-3', '1.5'])('videoId %p responde 400', (videoId) => {
    expect(() => controller.getSyncTimeline(259, videoId as any)).toThrow(BadRequestException);
    expect(service.getSyncTimeline).not.toHaveBeenCalled();
  });

  it('con un videoId válido consulta el servicio', async () => {
    await controller.getSyncTimeline(259, '12');
    expect(service.getSyncTimeline).toHaveBeenCalledWith(259, 12);
  });
});
