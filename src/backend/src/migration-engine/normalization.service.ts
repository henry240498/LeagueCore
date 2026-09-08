import { Injectable } from '@nestjs/common';
import { normalizeText } from '../research/name-match.util';
import { REGISTROFUTBOL_PHASE_CATALOG, type EntityType, type MatchRef } from './types';

export interface NormalizationResult {
  ok: boolean;
  payload?: unknown;
  error?: string;
}

function trimStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function toIsoDate(v: unknown): string | undefined {
  const s = trimStr(v);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function toInt(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

// Canonicaliza contra el catálogo real de ~19 valores confirmado en la auditoría (§15) por
// coincidencia normalizada -- si no coincide con ninguno, se conserva el texto tal cual capturado
// en vez de descartarlo (dbo.matches.phase sigue siendo texto libre, gap real documentado en el
// plan, no se inventa un valor que no vino de la fuente).
function canonicalizePhase(v: unknown): string | undefined {
  const s = trimStr(v);
  if (!s) return undefined;
  const match = REGISTROFUTBOL_PHASE_CATALOG.find((p) => normalizeText(p) === normalizeText(s));
  return match ?? s;
}

// Registro Fútbol le agrega " Conmebol" al nombre de cualquier campeonato continental en sus filas
// de campaña ("Copa Libertadores Conmebol", "Mercosur Conmebol", etc. -- confirmado real en la
// captura de la Fase 0) -- es una etiqueta de confederación del listado, no parte del nombre real
// del campeonato (el propio catálogo de campeonatos de la fuente los lista sin ese sufijo: "Copa
// Libertadores", "Copa Sudamericana", "Mercosur"...). Sin esto, "Copa Libertadores Conmebol" nunca
// hace match exacto con la fila real ya cargada en LeagueCore ("Copa Libertadores") y siempre
// queda ambiguo entre varios candidatos con la misma superposición de palabras -- bug real
// encontrado en la captura piloto. No se toca si el nombre restante quedaría vacío.
// Alias reales confirmados dos veces (Fase 0 y la migración masiva de goleadores 31-80): el propio
// catálogo de campeonatos de Registro Fútbol nombra estas dos copas sin el prefijo "Copa" ("Mercosur",
// "Intercontinental"), mientras que LeagueCore ya las tenía cargadas con el prefijo. Sin este alias,
// cada corrida nueva vuelve a generar el mismo conflicto ambiguo (empate de superposición de
// palabras) contra la fila real ya existente, en vez de reconocerla -- confirmado repitiéndose
// idéntico en dos corridas separadas antes de agregar esto.
const COMPETITION_ALIASES: Record<string, string> = {
  mercosur: 'Copa Mercosur',
  intercontinental: 'Copa Intercontinental',
  // Confirmado real migrando el catálogo completo de 425 equipos: la fuente devuelve "Copa Chile
  // Primera A y Primera B" como campeonato real en 804 campañas distintas, y ya se resolvió una vez
  // (conflicto real, sim. 99%) como el mismo "Copa Chile" que LeagueCore ya tenía cargado -- sin
  // este alias, cada una de esas 804 filas repite la misma ambigüedad nunca resuelta de raíz.
  'copa chile primera a y primera b': 'Copa Chile',
};

function stripConmebolSuffix(name: string): string {
  const stripped = name.replace(/\s+conmebol\s*$/i, '').trim();
  const withoutSuffix = stripped.length > 0 ? stripped : name;
  return COMPETITION_ALIASES[normalizeText(withoutSuffix)] ?? withoutSuffix;
}

function normalizeMatchRef(ref: any): MatchRef | null {
  if (!ref) return null;
  const competitionNameRaw = trimStr(ref.competitionName);
  const matchDate = toIsoDate(ref.matchDate);
  const homeTeamName = trimStr(ref.homeTeamName);
  const homeTeamCountry = trimStr(ref.homeTeamCountry);
  const awayTeamName = trimStr(ref.awayTeamName);
  const awayTeamCountry = trimStr(ref.awayTeamCountry);
  if (!competitionNameRaw || !matchDate || !homeTeamName || !homeTeamCountry || !awayTeamName || !awayTeamCountry) return null;
  return {
    competitionName: stripConmebolSuffix(competitionNameRaw), competitionCountry: trimStr(ref.competitionCountry), seasonStartYear: toInt(ref.seasonStartYear),
    matchDate, homeTeamName, homeTeamCountry, awayTeamName, awayTeamCountry,
  };
}

// Valida/coerciona raw_payload (JSON ya estructurado por quien capturó, ver types.ts) a la forma
// normalizada -- nunca parsea HTML/XML (esa traducción ya la hizo la captura supervisada). El único
// trabajo real acá es: tipos correctos (fechas ISO, enteros), trim de texto, canonicalizar `phase`
// contra el catálogo real, y rechazar (motivo explícito) lo que le falte un campo obligatorio -- sin
// inventar ningún valor ausente.
@Injectable()
export class NormalizationService {
  normalize(entityType: EntityType, raw: any): NormalizationResult {
    switch (entityType) {
      case 'competition': {
        const name = trimStr(raw.name);
        if (!name) return { ok: false, error: 'Falta name' };
        return { ok: true, payload: { name: stripConmebolSuffix(name), country: trimStr(raw.country) } };
      }
      case 'season': {
        const competitionName = trimStr(raw.competitionName);
        const startYear = toInt(raw.startYear);
        if (!competitionName || !startYear) return { ok: false, error: 'Falta competitionName o startYear' };
        return {
          ok: true,
          payload: {
            competitionName: stripConmebolSuffix(competitionName), country: trimStr(raw.country), startYear, endYear: toInt(raw.endYear),
            championTeamName: trimStr(raw.championTeamName),
            participantTeamName: trimStr(raw.participantTeamName), participantTeamCountry: trimStr(raw.participantTeamCountry),
          },
        };
      }
      case 'team': {
        const name = trimStr(raw.name);
        if (!name) return { ok: false, error: 'Falta name' };
        return { ok: true, payload: { name, country: trimStr(raw.country), city: trimStr(raw.city) } };
      }
      case 'venue': {
        const name = trimStr(raw.name);
        if (!name) return { ok: false, error: 'Falta name' };
        return { ok: true, payload: { name, city: trimStr(raw.city), country: trimStr(raw.country) } };
      }
      case 'player': {
        const firstName = trimStr(raw.firstName);
        const lastName = trimStr(raw.lastName);
        if (!firstName || !lastName) return { ok: false, error: 'Falta firstName o lastName' };
        return {
          ok: true,
          payload: { firstName, lastName, dateOfBirth: toIsoDate(raw.dateOfBirth), nationality: trimStr(raw.nationality), position: trimStr(raw.position) },
        };
      }
      case 'official': {
        const firstName = trimStr(raw.firstName);
        const lastName = trimStr(raw.lastName);
        if (!firstName || !lastName) return { ok: false, error: 'Falta firstName o lastName' };
        return {
          ok: true,
          payload: { firstName, lastName, dateOfBirth: toIsoDate(raw.dateOfBirth), nationality: trimStr(raw.nationality), officialTypeName: trimStr(raw.officialTypeName) },
        };
      }
      case 'coach': {
        const firstName = trimStr(raw.firstName);
        const lastName = trimStr(raw.lastName);
        if (!firstName || !lastName) return { ok: false, error: 'Falta firstName o lastName' };
        return { ok: true, payload: { firstName, lastName, nationality: trimStr(raw.nationality) } };
      }
      case 'player_team_history': {
        const playerFirstName = trimStr(raw.playerFirstName);
        const playerLastName = trimStr(raw.playerLastName);
        const teamName = trimStr(raw.teamName);
        const teamCountry = trimStr(raw.teamCountry);
        if (!playerFirstName || !playerLastName || !teamName || !teamCountry) {
          return { ok: false, error: 'Falta playerFirstName, playerLastName, teamName o teamCountry' };
        }
        return {
          ok: true,
          payload: {
            playerFirstName, playerLastName, playerDateOfBirth: toIsoDate(raw.playerDateOfBirth),
            teamName, teamCountry, competitionName: trimStr(raw.competitionName), seasonStartYear: toInt(raw.seasonStartYear),
            startDate: toIsoDate(raw.startDate), endDate: toIsoDate(raw.endDate), squadNumber: toInt(raw.squadNumber),
          },
        };
      }
      case 'coach_team_history': {
        const coachFirstName = trimStr(raw.coachFirstName);
        const coachLastName = trimStr(raw.coachLastName);
        const teamName = trimStr(raw.teamName);
        const teamCountry = trimStr(raw.teamCountry);
        if (!coachFirstName || !coachLastName || !teamName || !teamCountry) {
          return { ok: false, error: 'Falta coachFirstName, coachLastName, teamName o teamCountry' };
        }
        return {
          ok: true,
          payload: {
            coachFirstName, coachLastName, coachNationality: trimStr(raw.coachNationality),
            teamName, teamCountry, seasonStartYear: toInt(raw.seasonStartYear),
            startDate: toIsoDate(raw.startDate), endDate: toIsoDate(raw.endDate),
          },
        };
      }
      case 'match': {
        const ref = normalizeMatchRef(raw.ref);
        if (!ref) return { ok: false, error: 'matchRef incompleto (competitionName, country, matchDate, homeTeamName, awayTeamName)' };
        return {
          ok: true,
          payload: {
            ref,
            venueName: trimStr(raw.venueName),
            phase: canonicalizePhase(raw.phase),
            round: trimStr(raw.round),
            homeScore: toInt(raw.homeScore),
            awayScore: toInt(raw.awayScore),
            attendance: toInt(raw.attendance),
            officials: Array.isArray(raw.officials)
              ? raw.officials.map((o: any) => ({ firstName: trimStr(o.firstName), lastName: trimStr(o.lastName), role: trimStr(o.role) ?? 'main_referee' })).filter((o: any) => o.firstName && o.lastName)
              : undefined,
            coaches: Array.isArray(raw.coaches)
              ? raw.coaches.map((c: any) => ({ firstName: trimStr(c.firstName), lastName: trimStr(c.lastName), teamName: trimStr(c.teamName) })).filter((c: any) => c.firstName && c.lastName && c.teamName)
              : undefined,
          },
        };
      }
      case 'lineup': {
        const matchRef = normalizeMatchRef(raw.matchRef);
        const teamName = trimStr(raw.teamName);
        const playerFirstName = trimStr(raw.playerFirstName);
        const playerLastName = trimStr(raw.playerLastName);
        if (!matchRef || !teamName || !playerFirstName || !playerLastName) return { ok: false, error: 'Falta matchRef, teamName o nombre del jugador' };
        return {
          ok: true,
          payload: {
            matchRef, teamName, playerFirstName, playerLastName,
            isStarting: typeof raw.isStarting === 'boolean' ? raw.isStarting : undefined,
            shirtNumber: toInt(raw.shirtNumber), position: trimStr(raw.position), minutesPlayed: toInt(raw.minutesPlayed),
          },
        };
      }
      case 'goal': {
        const matchRef = normalizeMatchRef(raw.matchRef);
        const teamName = trimStr(raw.teamName);
        const playerFirstName = trimStr(raw.playerFirstName);
        const playerLastName = trimStr(raw.playerLastName);
        if (!matchRef || !teamName || !playerFirstName || !playerLastName) return { ok: false, error: 'Falta matchRef, teamName o nombre del jugador' };
        return {
          ok: true,
          payload: {
            matchRef, teamName, playerFirstName, playerLastName, minute: toInt(raw.minute),
            ownGoal: !!raw.ownGoal, penalty: !!raw.penalty,
            assistFirstName: trimStr(raw.assistFirstName), assistLastName: trimStr(raw.assistLastName),
          },
        };
      }
      case 'card': {
        const matchRef = normalizeMatchRef(raw.matchRef);
        const teamName = trimStr(raw.teamName);
        const playerFirstName = trimStr(raw.playerFirstName);
        const playerLastName = trimStr(raw.playerLastName);
        const cardType = trimStr(raw.cardType);
        if (!matchRef || !teamName || !playerFirstName || !playerLastName || !cardType) return { ok: false, error: 'Falta matchRef, teamName, jugador o cardType' };
        if (!['yellow', 'red', 'second_yellow'].includes(cardType)) return { ok: false, error: `cardType inválido: ${cardType}` };
        return { ok: true, payload: { matchRef, teamName, playerFirstName, playerLastName, cardType, minute: toInt(raw.minute), reason: trimStr(raw.reason) } };
      }
      case 'penalty': {
        const matchRef = normalizeMatchRef(raw.matchRef);
        const teamName = trimStr(raw.teamName);
        const playerFirstName = trimStr(raw.playerFirstName);
        const playerLastName = trimStr(raw.playerLastName);
        const outcome = trimStr(raw.outcome);
        if (!matchRef || !teamName || !playerFirstName || !playerLastName || !outcome) return { ok: false, error: 'Falta matchRef, teamName, jugador o outcome' };
        if (!['missed', 'saved'].includes(outcome)) return { ok: false, error: `outcome inválido: ${outcome} (convertido va como goal con penalty:true)` };
        return { ok: true, payload: { matchRef, teamName, playerFirstName, playerLastName, outcome, minute: toInt(raw.minute) } };
      }
      case 'match_team_stats': {
        const matchRef = normalizeMatchRef(raw.matchRef);
        const teamName = trimStr(raw.teamName);
        if (!matchRef || !teamName) return { ok: false, error: 'Falta matchRef o teamName' };
        return {
          ok: true,
          payload: {
            matchRef, teamName, possessionPct: toInt(raw.possessionPct), shots: toInt(raw.shots),
            shotsOnTarget: toInt(raw.shotsOnTarget), corners: toInt(raw.corners), fouls: toInt(raw.fouls),
          },
        };
      }
      default:
        return { ok: false, error: `entityType desconocido: ${entityType}` };
    }
  }
}
