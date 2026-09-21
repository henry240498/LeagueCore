import { BadRequestException } from '@nestjs/common';
import { ScoutingController } from './scouting.controller';
import { ScoutingService } from './scouting.service';

// Regresión: GET /scouting/compare sin el parámetro `ids` daba 500 (TypeError: undefined.split)
// en lugar del 400 de validación del servicio.
describe('ScoutingController.comparePlayers', () => {
  // El servicio real valida la cantidad antes de tocar la base, así que basta un pool vacío.
  const controller = new ScoutingController(new ScoutingService({} as any));

  it('sin ids responde 400 (antes lanzaba TypeError -> 500)', async () => {
    // Con el bug, comparePlayers(undefined) lanzaba TypeError de forma síncrona y este test fallaba.
    await expect(controller.comparePlayers(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con un solo jugador o ids inválidos responde 400', async () => {
    await expect(controller.comparePlayers('7')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.comparePlayers('abc')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.comparePlayers('')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pasa los ids numéricos al servicio', async () => {
    const service = { comparePlayers: jest.fn().mockResolvedValue([]) } as unknown as ScoutingService;
    await new ScoutingController(service).comparePlayers('3,5');
    expect(service.comparePlayers).toHaveBeenCalledWith([3, 5]);
  });
});
