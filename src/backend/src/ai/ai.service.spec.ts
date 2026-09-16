import { detectIntent, normalize, parseScoutingHints } from './ai.service';
import { formatTimestamp, minuteToSeconds } from '../video/video.service';

describe('normalize', () => {
  it('minúsculas, sin tildes y sin ruido', () => {
    expect(normalize('¿Por qué PERDIMOS el partido?')).toBe('por que perdimos el partido');
  });
});

describe('detectIntent', () => {
  it.each([
    ['¿Por qué perdimos el partido?', 'por_que_perdimos'],
    ['Resumí el último partido', 'resumen_partido'],
    ['¿Quiénes están lesionados?', 'lesionados'],
    ['¿Cuándo jugamos?', 'proximo_partido'],
    ['Goleadores del equipo', 'goleadores'],
    ['¿Cómo venimos? racha', 'racha'],
    ['Compará Juan vs Pedro', 'comparar'],
    ['Busco un extremo menor de 23 años', 'buscar_jugador'],
    ['¿Cómo juega cuando va perdiendo?', 'estado_marcador'],
    ['¿Dónde genera cuando empata?', 'estado_marcador'],
    ['¿Qué hay pendiente?', 'alertas'],
    ['Hola, ¿cómo estás?', 'desconocido'],
  ])('"%s" -> %s', (question, expected) => {
    expect(detectIntent(question)).toBe(expected);
  });
});

describe('parseScoutingHints', () => {
  it('extrae edad, posición y velocidad', () => {
    const hints = parseScoutingHints('Busco un extremo menor de 23 años, rápido y goleador');
    expect(hints.maxAge).toBe(23);
    expect(hints.position).toBe('Delantero');
    expect(hints.minSpeed).toBe(80);
    expect(hints.minGoals).toBe(3);
  });

  it('no inventa filtros', () => {
    expect(parseScoutingHints('Hola')).toEqual({});
  });
});

describe('minuteToSeconds (re-export local del concepto video)', () => {
  it('coherente con Fase 4', () => {
    expect(minuteToSeconds(37, 2, 0)).toBe(37 * 60 + 120);
    expect(formatTimestamp(37 * 60 + 42)).toBe('37:42');
  });
});
