import { buildGrid, InsightsService, stateAtMinute } from './insights.service';

describe('buildGrid', () => {
  it('agrega puntos en celdas 0-100', () => {
    const grid = buildGrid(
      [
        { x: 5, y: 5 },
        { x: 6, y: 6 },
        { x: 95, y: 95 },
      ],
      8,
      12,
    );
    expect(grid.max).toBe(2);
    expect(grid.cells).toHaveLength(2);
  });

  it('respeta pesos (minutos ponderados)', () => {
    const grid = buildGrid([{ x: 50, y: 50, w: 5 }], 8, 12);
    expect(grid.max).toBe(5);
  });

  it('vacío no rompe', () => {
    const grid = buildGrid([], 8, 12);
    expect(grid.max).toBe(0);
    expect(grid.cells).toHaveLength(0);
  });
});

describe('stateAtMinute', () => {
  const goals = [
    { minute: 23, teamId: 1 },
    { minute: 55, teamId: 2 },
    { minute: 80, teamId: 2 },
  ];
  it('EMPATANDO al inicio', () => {
    expect(stateAtMinute(goals, 1, 10)).toBe('EMPATANDO');
  });
  it('GANANDO tras el 1-0', () => {
    expect(stateAtMinute(goals, 1, 30)).toBe('GANANDO');
    expect(stateAtMinute(goals, 2, 30)).toBe('PERDIENDO');
  });
  it('PERDIENDO tras el 1-2', () => {
    expect(stateAtMinute(goals, 1, 85)).toBe('PERDIENDO');
  });
});

describe('InsightsService - plantillas', () => {
  it('valida secciones contra la entidad', async () => {
    const service = new InsightsService({} as any);
    await expect(
      service.createTemplate({ name: 'X', entity: 'MATCH', sectionsJson: '["INVENTADA"]' } as any),
    ).rejects.toThrow();
    await expect(
      service.createTemplate({ name: 'X', entity: 'MATCH', sectionsJson: 'no-json' } as any),
    ).rejects.toThrow();
  });
});
