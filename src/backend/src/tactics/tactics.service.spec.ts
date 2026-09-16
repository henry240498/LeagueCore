import { BadRequestException } from '@nestjs/common';
import { deriveZone, evaluateFormula, TacticsService } from './tactics.service';

describe('deriveZone', () => {
  it('clasifica por tercios y carriles', () => {
    expect(deriveZone(50, 10)).toBe('TERCIO_DEF_CENTRO');
    expect(deriveZone(10, 50)).toBe('MEDIO_IZQ');
    expect(deriveZone(90, 90)).toBe('ULTIMO_TERCIO_DER');
  });
});

describe('evaluateFormula', () => {
  it('evalúa el índice ofensivo de ejemplo del pedido', () => {
    const value = evaluateFormula('goles*5+asistencias*4+tiros*2-faltas', {
      goles: 2,
      asistencias: 1,
      tiros: 5,
      faltas: 3,
    });
    expect(value).toBe(21);
  });

  it('rechaza variables desconocidas', () => {
    expect(() => evaluateFormula('goles*5+pases_fallados', { goles: 1 })).toThrow(BadRequestException);
  });

  it('rechaza caracteres no permitidos', () => {
    expect(() => evaluateFormula('goles;DROP TABLE', { goles: 1 })).toThrow(BadRequestException);
  });

  it('evalúa una métrica válida', () => {
    expect(evaluateFormula('goles*5+asistencias*4+tiros*2', { goles: 2, asistencias: 1, tiros: 5 })).toBe(24);
  });
});

describe('TacticsService - jugadas', () => {
  function createMockPool() {
    const plays: any[] = [];
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
          if (q.startsWith('insert into dbo.tactical_plays')) {
            if (plays.some((p) => p.code === inputs.code)) {
              const err: any = new Error('duplicate');
              err.number = 2627;
              throw err;
            }
            const row: any = { id: nextId++, usage_count: 0 };
            for (const [k, v] of Object.entries(inputs)) row[k] = v;
            plays.push(row);
            return { recordset: [{ id: row.id }] };
          }
          if (q.startsWith('select * from dbo.tactical_plays where id = @id')) {
            return { recordset: plays.filter((p) => p.id === inputs.id) };
          }
          if (q.startsWith('select * from dbo.tactical_plays')) {
            return { recordset: plays };
          }
          return { recordset: [] };
        },
      };
      return req;
    };
    return { request };
  }

  it('crea una jugada y rechaza códigos duplicados', async () => {
    const service = new TacticsService(createMockPool() as any);
    const created = await service.createPlay({ code: 'CORNER-001', category: 'CORNER', title: 'Primer palo' } as any);
    expect(created.code).toBe('CORNER-001');
    await expect(
      service.createPlay({ code: 'CORNER-001', category: 'CORNER', title: 'Otra' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza diagramJson inválido', async () => {
    const service = new TacticsService(createMockPool() as any);
    await expect(
      service.createPlay({ code: 'X-1', category: 'ATTACK', title: 'T', diagramJson: 'no-json' } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
