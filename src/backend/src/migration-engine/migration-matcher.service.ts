import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { EntityMatcherService, GENERIC_COMPETITION_WORDS, type ExistingEntityRef } from '../import-engine/entity-matcher.service';
import { bestMatch, normalizeText, type PersonCandidate } from '../research/name-match.util';
import type { EntityType, MatchVerdict, StagingItemRow } from './types';

const SOURCE_CODE = 'registrofutbol_migration';

// Alias reales confirmados (migración masiva del catálogo completo de 425 equipos): estos pares
// SIGUEN generando el mismo conflicto ambiguo (~99% de similitud, nunca 100%) cada vez que se
// vuelve a capturar el mismo nombre, aunque ya se haya resuelto como "vincular con el existente"
// -- link_existing sólo marca la fila existente, no crea un alias permanente, así que cada corrida
// nueva repite la misma ambigüedad de cero. A diferencia del alias de competiciones (aplicado en
// NormalizationService), éste vive acá porque el nombre de equipo aparece embebido en muchos tipos
// de payload distintos (team/player_team_history/match/lineup/goal/...) -- centralizarlo en
// matchTeam() cubre todos esos casos con un solo cambio.
const TEAM_ALIASES: Record<string, string> = {
  'sao paulo': 'São Paulo FC',
  'universitario sucre': 'Universitario De Sucre',
  'recoleta': 'Deportivo Recoleta',
  'provincial ovalle': 'Ovalle',
  'guarani paraguay': 'Guaraní',
  '12 octubre paraguay': '12 de Octubre',
};

// Mismo problema, mismo tipo de solución -- una persona ya cargada con un nombre menos completo
// (ej. Fase 0 la creó como "Rodrigo Javier Millar" desde una fuente que no traía el apellido
// materno) vuelve a aparecer en una captura posterior con el nombre completo real ("Rodrigo Javier
// Millar Carvajal") -- el fallback de nombre completo SÍ la encuentra, pero nunca a 100% exacto, así
// que cada corrida repite el mismo conflicto ambiguo aunque ya se haya vinculado antes. Clave =
// nombre completo normalizado tal cual llega en el payload nuevo.
const PERSON_ALIASES: Record<string, { firstName: string; lastName: string }> = {
  'rodrigo javier millar carvajal': { firstName: 'Rodrigo Javier', lastName: 'Millar' },
};

export interface MatchOutcome {
  verdict: MatchVerdict;
  matchedEntityId: number | null;
  score: number;
}

// Identidad de cada tipo de entidad "de catálogo" (competición/temporada/equipo/estadio/jugador/
// oficial/técnico/partido) -- nunca similitud de texto sola (regla explícita del pedido), siempre
// acotado por un segundo atributo real: país/ciudad para equipos y estadios (dbo.teams.country,
// migración 034, ya existe justo para esto), apellido+fecha de nacimiento+nacionalidad para
// personas. Los tipos de "relación/evento" (lineup/goal/card/penalty/etc.) no tienen aquí una
// pregunta de identidad propia -- CommitService resuelve sus dependencias contra producción y
// controla idempotencia al insertar, mismo patrón que ya usa linkClub() en el motor de investigación.
@Injectable()
export class MigrationMatcherService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly entityMatcher: EntityMatcherService,
  ) {}

  async match(item: StagingItemRow): Promise<MatchOutcome> {
    const payload: any = JSON.parse(item.normalizedPayload ?? item.rawPayload);
    switch (item.entityType) {
      case 'competition':
        return this.matchCompetition(payload.name, payload.country);
      case 'team':
        return this.matchTeam(payload.name, payload.country);
      case 'venue':
        return this.matchVenue(payload.name, payload.city, payload.country);
      case 'player':
        return this.matchPerson('player', payload.firstName, payload.lastName, payload.dateOfBirth, payload.nationality, payload.position);
      case 'official':
        return this.matchPerson('official', payload.firstName, payload.lastName, payload.dateOfBirth, payload.nationality, undefined);
      case 'coach':
        return this.matchPerson('coach', payload.firstName, payload.lastName, undefined, payload.nationality, undefined);
      case 'season':
        return this.matchSeasonDeterministic(payload);
      case 'match':
        return { verdict: 'new', matchedEntityId: null, score: 0 }; // resuelto de verdad en CommitService (necesita FKs ya committeados)
      default:
        return { verdict: 'new', matchedEntityId: null, score: 0 };
    }
  }

  // country opcional -- una competición continental (Copa Libertadores, etc.) no tiene uno solo, y
  // LeagueCore ya guarda country=NULL para esos casos reales (ver types.ts). Sin country, se
  // compara contra TODAS las competiciones en vez de acotar por país.
  async matchCompetition(name: string, country?: string): Promise<MatchOutcome> {
    const request = this.pool.request();
    let where = '1=1';
    if (country) { request.input('country', sql.NVarChar, country); where = 'country = @country OR country IS NULL'; }
    const result = await request.query(`SELECT id, name, external_source, external_id FROM dbo.competitions WHERE ${where}`);
    return this.runEntityMatch(name, result.recordset, GENERIC_COMPETITION_WORDS);
  }

  // country opcional -- Registro Fútbol no lo da para la mayoría de los equipos de su catálogo
  // general (sólo por sufijo ocasional en el nombre). Sin country, compara contra TODOS los equipos
  // en vez de acotar por país (mismo criterio ya usado en matchCompetition).
  async matchTeam(name: string, country?: string): Promise<MatchOutcome> {
    const aliased = TEAM_ALIASES[normalizeText(name)] ?? name;
    const request = this.pool.request();
    let where = '1=1';
    if (country) { request.input('country', sql.NVarChar, country); where = 'country = @country OR country IS NULL'; }
    const result = await request.query(`SELECT id, name, external_source, external_id FROM dbo.teams WHERE ${where}`);
    return this.runEntityMatch(aliased, result.recordset);
  }

  async matchVenue(name: string, city?: string, country?: string): Promise<MatchOutcome> {
    const request = this.pool.request();
    let where = '1=1';
    if (country) { request.input('country', sql.NVarChar, country); where += ' AND (country = @country OR country IS NULL)'; }
    if (city) { request.input('city', sql.NVarChar, city); where += ' AND (city = @city OR city IS NULL)'; }
    const result = await request.query(`SELECT id, name FROM dbo.venues WHERE ${where}`);
    return this.runEntityMatch(name, result.recordset);
  }

  private runEntityMatch(name: string, rows: any[], extraGenericWords?: Set<string>): MatchOutcome {
    const existing: ExistingEntityRef[] = rows.map((r) => ({ id: r.id, name: r.name, externalSource: r.external_source ?? null, externalId: r.external_id ?? null }));
    const result = this.entityMatcher.match(name, '', SOURCE_CODE, existing, extraGenericWords);
    if (result.decision === 'new') return { verdict: 'new', matchedEntityId: null, score: result.similarityPct };
    if (result.decision === 'conflict') return { verdict: 'ambiguous', matchedEntityId: result.existingEntityId, score: result.similarityPct };
    return { verdict: 'same', matchedEntityId: result.existingEntityId, score: result.similarityPct }; // exact_external_match | exact_name_match
  }

  // Jugadores/oficiales/técnicos: shortlist indexado por apellido normalizado (migración 047) en vez
  // de escanear toda la tabla como hace hoy name-match.util.ts desde el motor de investigación --
  // acá sí importa la escala (una migración histórica puede rondar miles de personas, no "decenas").
  async matchPerson(
    entityType: 'player' | 'official' | 'coach',
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    nationality?: string,
    extra?: string,
  ): Promise<MatchOutcome> {
    const alias = PERSON_ALIASES[normalizeText(`${firstName} ${lastName}`)];
    if (alias) { firstName = alias.firstName; lastName = alias.lastName; }

    const table = entityType === 'player' ? 'players' : entityType === 'official' ? 'officials' : 'coaches';
    const dobExpr = entityType === 'coach' ? 'NULL' : 'date_of_birth'; // dbo.coaches no tiene date_of_birth (ver reporte de esquema)
    const extraExpr = entityType === 'player' ? 'position' : 'NULL'; // sólo jugador tiene una señal bonus real (posición)
    const result = await this.pool
      .request()
      .input('last_name', sql.NVarChar, normalizeText(lastName))
      .query(
        `SELECT id, first_name, last_name, ${dobExpr} AS date_of_birth, nationality, ${extraExpr} AS extra
         FROM dbo.${table} WHERE normalized_last_name = @last_name`,
      );
    const candidates: PersonCandidate[] = result.recordset.map((r: any) => ({
      id: r.id, firstName: r.first_name, lastName: r.last_name, dateOfBirth: r.date_of_birth, nationality: r.nationality, extra: r.extra,
    }));
    const { verdict, best } = bestMatch({ firstName, lastName, dateOfBirth, nationality, extra }, candidates);
    if (verdict !== 'different') {
      return { verdict: verdict === 'same_person' ? 'same' : 'ambiguous', matchedEntityId: best!.candidate.id, score: best!.score };
    }

    // El apellido exacto no encontró nada -- puede ser la MISMA persona partida distinto (nombres
    // españoles con más de un nombre de pila son ambiguos de partir sin una fuente de verdad
    // adicional -- bug real encontrado migrando 30 goleadores históricos: "Esteban Efraín Paredes
    // Quintanilla" quedó duplicado porque un script lo partió firstName="Esteban"/
    // lastName="Efraín Paredes Quintanilla" mientras ya existía como firstName="Esteban Efraín"/
    // lastName="Paredes" -- ningún apellido exacto coincidía). Antes de aceptar "nuevo", se busca
    // por superposición de palabras significativas del nombre completo (mismo mecanismo ya probado
    // para equipos/competiciones en EntityMatcherService) -- nunca se auto-declara "misma persona"
    // por esta vía sola, como mucho queda como conflicto real para que un admin decida (regla del
    // proyecto: nunca fusionar con incertidumbre).
    return this.matchPersonByFullNameFallback(table, firstName, lastName, dobExpr);
  }

  private async matchPersonByFullNameFallback(table: string, firstName: string, lastName: string, dobExpr: string): Promise<MatchOutcome> {
    const queryFullName = `${firstName} ${lastName}`;
    const words = normalizeText(queryFullName).split(' ').filter((w) => w.length > 3);
    if (words.length === 0) return { verdict: 'new', matchedEntityId: null, score: 0 };

    const request = this.pool.request();
    const likeClauses = words.map((w, i) => {
      request.input(`w${i}`, sql.NVarChar, `%${w}%`);
      return `normalized_full_name LIKE @w${i}`;
    });
    const result = await request.query(
      `SELECT TOP 50 id, first_name, last_name, ${dobExpr} AS date_of_birth FROM dbo.${table} WHERE ${likeClauses.join(' OR ')}`,
    );
    if (result.recordset.length === 0) return { verdict: 'new', matchedEntityId: null, score: 0 };

    const existing: ExistingEntityRef[] = result.recordset.map((r: any) => ({ id: r.id, name: `${r.first_name} ${r.last_name}` }));
    const outcome = this.runEntityMatch(queryFullName, existing);
    if (outcome.verdict === 'new') return outcome;
    // Coincidencia real encontrada por esta vía secundaria -- más débil que el camino principal
    // (apellido exacto + fecha de nacimiento/nacionalidad), así que nunca se declara "misma persona"
    // sola: como mínimo ambiguo, para revisión real de un admin.
    return { verdict: 'ambiguous', matchedEntityId: outcome.matchedEntityId, score: outcome.score };
  }

  private async matchSeasonDeterministic(payload: { competitionId?: number; competitionName: string; country?: string; startYear: number }): Promise<MatchOutcome> {
    let competitionId = payload.competitionId;
    if (!competitionId) {
      const comp = await this.matchCompetition(payload.competitionName, payload.country);
      if (comp.verdict !== 'same') return { verdict: 'new', matchedEntityId: null, score: 0 }; // no se puede resolver la competición todavía
      competitionId = comp.matchedEntityId!;
    }
    const result = await this.pool
      .request()
      .input('competition_id', sql.Int, competitionId)
      .input('start_year', sql.SmallInt, payload.startYear)
      .query('SELECT id FROM dbo.seasons WHERE competition_id = @competition_id AND start_year = @start_year');
    if (result.recordset.length > 0) return { verdict: 'same', matchedEntityId: result.recordset[0].id, score: 100 };
    return { verdict: 'new', matchedEntityId: null, score: 0 };
  }
}
