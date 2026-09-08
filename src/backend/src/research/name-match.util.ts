// Matching multi-atributo para el motor de investigación -- nunca compara solamente por nombre
// (pedido explícito: "Aldo Bobadilla" nunca se identifica sólo por coincidir el nombre). Reutiliza
// el mismo dataset chico y curado (jugadores/oficiales reales, decenas de filas hoy) así que
// comparar en memoria (JS) es correcto y más simple que Levenshtein en SQL.

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export interface PersonCandidate {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | Date | null;
  nationality: string | null;
  extra?: string | null; // posición (jugador) o tipo (oficial), bonus opcional
}

export interface PersonQuery {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  nationality?: string | null;
  extra?: string | null;
}

export type MatchVerdict = 'same_person' | 'ambiguous' | 'different';

export interface ScoredCandidate {
  candidate: PersonCandidate;
  score: number;
}

// Umbrales calibrados para un dataset chico y curado: nombre exacto normalizado ya es evidencia
// fuerte (60 puntos) porque la probabilidad real de dos personas distintas con nombre y apellido
// idénticos en esta base es baja -- una fecha de nacimiento CONTRADICTORIA hunde el puntaje muy por
// debajo de cualquier umbral (nunca funde a dos personas reales distintas).
export function scoreMatch(query: PersonQuery, candidate: PersonCandidate): number {
  const qFull = `${normalizeText(query.firstName)} ${normalizeText(query.lastName)}`.trim();
  const cFull = `${normalizeText(candidate.firstName)} ${normalizeText(candidate.lastName)}`.trim();
  const qLast = normalizeText(query.lastName);
  const cLast = normalizeText(candidate.lastName);
  const qFirst = normalizeText(query.firstName);
  const cFirst = normalizeText(candidate.firstName);

  let score = 0;
  if (qFull === cFull) {
    score += 60;
  } else if (qLast === cLast && (cFirst.includes(qFirst) || qFirst.includes(cFirst)) && qFirst.length > 0) {
    score += 35;
  } else if (qLast === cLast) {
    score += 15;
  } else {
    return 0; // apellido totalmente distinto -- no es candidato real, ni siquiera ambiguo
  }

  const qDob = normalizeDate(query.dateOfBirth);
  const cDob = normalizeDate(candidate.dateOfBirth);
  if (qDob && cDob) {
    score += qDob === cDob ? 30 : -100;
  }

  const qNat = normalizeText(query.nationality);
  const cNat = normalizeText(candidate.nationality);
  if (qNat && cNat) {
    score += qNat === cNat ? 10 : -20;
  }

  const qExtra = normalizeText(query.extra);
  const cExtra = normalizeText(candidate.extra);
  if (qExtra && cExtra) {
    score += qExtra === cExtra ? 5 : -5;
  }

  return score;
}

export function bestMatch(query: PersonQuery, candidates: PersonCandidate[]): { verdict: MatchVerdict; best: ScoredCandidate | null; runnerUp: ScoredCandidate | null } {
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreMatch(query, candidate) }))
    .filter((s) => s.score !== 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0] ?? null;
  const runnerUp = scored[1] ?? null;

  if (!best || best.score < 30) return { verdict: 'different', best: null, runnerUp: null };
  if (best.score >= 60) return { verdict: 'same_person', best, runnerUp };
  return { verdict: 'ambiguous', best, runnerUp };
}
