import { HealthController } from './health.controller';

// Pool mockeado: `query` resuelve (base arriba) o rechaza (base caída).
const poolWith = (queryImpl: () => Promise<unknown>) =>
  ({ request: () => ({ query: queryImpl }) }) as any;

describe('HealthController.check', () => {
  it('reporta ok y conexión cuando la base responde', async () => {
    const controller = new HealthController(poolWith(async () => ({})));
    const res = await controller.check();
    expect(res.status).toBe('ok');
    expect(res.database).toEqual({ connected: true });
  });

  it('reporta degraded sin lanzar 500 cuando la base está caída', async () => {
    const controller = new HealthController(
      poolWith(async () => {
        throw new Error('DB down');
      }),
    );
    const res = await controller.check();
    expect(res.status).toBe('degraded');
    expect(res.database).toEqual({ connected: false });
  });

  it('no filtra detalles internos (nombre de la base ni hora del servidor)', async () => {
    const controller = new HealthController(poolWith(async () => ({})));
    const res = await controller.check();
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('database_name');
    expect(serialized).not.toContain('server_time');
    // El objeto database sólo expone el booleano de conexión.
    expect(Object.keys(res.database)).toEqual(['connected']);
  });
});
