import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CompetitionsService } from '../competitions/competitions.service';
import { TeamsService } from '../teams/teams.service';
import { SeasonsService } from '../seasons/seasons.service';
import { VenuesService } from '../venues/venues.service';
import { PlayersService } from '../players/players.service';
import { OfficialsService } from '../officials/officials.service';
import { CoachesService } from '../coaches/coaches.service';
import { MatchesService } from '../matches/matches.service';
import { MatchEventsService } from '../matches/match-events.service';
import { MatchParticipantsService } from '../matches/match-participants.service';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { normalizeText } from '../research/name-match.util';
import { ProvenanceService } from '../research/provenance.service';
import { MigrationMatcherService } from './migration-matcher.service';
import { StagingRepository } from './staging.repository';
import type { MatchRef, StagingItemRow } from './types';

const SOURCE_NAME = 'Registro Fútbol';

// Escribe a producción. Cada método de tipo abre SU PROPIA transacción SQL (fix real del gap
// documentado en el plan: ni player-research.service.ts ni official-research.service.ts usan
// sql.Transaction hoy, un fallo a mitad de camino deja estado parcial). Simplificación explícita
// respecto del ideal del plan ("una transacción por campaña completa"): los servicios existentes
// (MatchesService, PlayersService, etc.) no aceptan una transacción externa inyectada -- envolver
// TODA una campaña en una sola transacción exigiría tocar la firma de todos esos servicios
// compartidos, fuera de alcance de esta pasada. En cambio, cada unidad que sí tiene varias escrituras
// relacionadas entre sí (crear un jugador + su primer club, crear un partido + su marcador) se hace
// dentro de una transacción propia vía SQL directo; las búsquedas idempotentes de resolución
// (resolveOrCreate*) reutilizan los servicios existentes tal cual, igual que ya hace
// PlayerResearchService -- son lecturas/creaciones de catálogo de bajo riesgo, no el punto débil real.
@Injectable()
export class CommitService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly staging: StagingRepository,
    private readonly tracker: SyncRunTracker,
    private readonly provenance: ProvenanceService,
    private readonly matcher: MigrationMatcherService,
    private readonly competitions: CompetitionsService,
    private readonly teams: TeamsService,
    private readonly seasons: SeasonsService,
    private readonly venues: VenuesService,
    private readonly players: PlayersService,
    private readonly officials: OfficialsService,
    private readonly coaches: CoachesService,
    private readonly matches: MatchesService,
    private readonly matchEvents: MatchEventsService,
    private readonly matchParticipants: MatchParticipantsService,
  ) {}

  async commit(item: StagingItemRow): Promise<void> {
    if (item.pipelineStatus !== 'validated') return;
    const payload: any = JSON.parse(item.normalizedPayload ?? item.rawPayload);
    try {
      const entityId = await this.dispatch(item, payload);
      if (entityId == null) return; // dependencia no resuelta -> ya quedó en 'error' dentro de dispatch()
      await this.staging.setCommitted(item.id, entityId);
      await this.tracker.bumpCounter(item.syncRunId, item.matchVerdict === 'same' ? 'total_updated' : 'total_new');
      await this.tracker.log(item.syncRunId, 'success', `${item.entityType} comprometido (#${entityId})`, item.entityType);
    } catch (err: any) {
      const message = err?.message ?? 'Error desconocido al comprometer';
      await this.staging.setError(item.id, message);
      await this.tracker.recordError(item.syncRunId, item.entityType, String(item.id), 'commit_error', message);
    }
  }

  private async dispatch(item: StagingItemRow, payload: any): Promise<number | null> {
    switch (item.entityType) {
      case 'competition': return this.commitCompetition(item, payload);
      case 'season': return this.commitSeason(item, payload);
      case 'team': return this.commitTeam(item, payload);
      case 'venue': return this.commitVenue(item, payload);
      case 'player': return this.commitPlayer(item, payload);
      case 'official': return this.commitOfficial(item, payload);
      case 'coach': return this.commitCoach(item, payload);
      case 'player_team_history': return this.commitPlayerTeamHistory(item, payload);
      case 'coach_team_history': return this.commitCoachTeamHistory(item, payload);
      case 'match': return this.commitMatch(item, payload);
      case 'lineup': return this.commitLineup(item, payload);
      case 'goal': return this.commitGoal(item, payload);
      case 'card': return this.commitCard(item, payload);
      case 'penalty': return this.commitPenalty(item, payload);
      case 'match_team_stats': return this.commitMatchTeamStats(item, payload);
      default: return null;
    }
  }

  // --- Catálogo (identidad ya resuelta por el matcher: 'same' usa matchedEntityId, 'new' crea) ---

  private async commitCompetition(item: StagingItemRow, payload: { name: string; country: string }): Promise<number> {
    if (item.matchVerdict === 'same' && item.matchedEntityId) return item.matchedEntityId;
    const created = await this.competitions.create({ name: payload.name, country: payload.country, competitionType: 'league', sport: 'Fútbol' } as any);
    await this.recordProvenance(item, 'competition', created.id, { name: payload.name, country: payload.country });
    return created.id;
  }

  private async commitSeason(
    item: StagingItemRow,
    payload: { competitionName: string; country?: string; startYear: number; endYear?: number; championTeamName?: string; participantTeamName?: string; participantTeamCountry?: string },
  ): Promise<number | null> {
    const comp = await this.matcher.matchCompetition(payload.competitionName, payload.country);
    if (comp.verdict !== 'same' || !comp.matchedEntityId) {
      await this.staging.setError(item.id, `Competición "${payload.competitionName}" (${payload.country}) no encontrada -- migrar la Fase 1 primero`);
      return null;
    }

    let seasonId: number;
    if (item.matchVerdict === 'same' && item.matchedEntityId) {
      seasonId = item.matchedEntityId;
    } else {
      const created = await this.seasons.create({ competitionId: comp.matchedEntityId, startYear: payload.startYear, endYear: payload.endYear } as any);
      seasonId = created.id;
      await this.recordProvenance(item, 'season', seasonId, { competitionName: payload.competitionName, startYear: String(payload.startYear) });
    }

    if (payload.championTeamName && payload.country) {
      const team = await this.matcher.matchTeam(payload.championTeamName, payload.country);
      if (team.verdict === 'same' && team.matchedEntityId) {
        await this.pool.request().input('id', sql.Int, seasonId).input('champion', sql.Int, team.matchedEntityId).query(
          'UPDATE dbo.seasons SET champion_team_id = @champion WHERE id = @id',
        );
      }
    }

    // Participación real equipo-temporada capturada directo (sin necesitar una relación
    // jugador-equipo de por medio) -- para la migración masiva de "todos los equipos" (historial de
    // campaña por equipo, sin plantel individual), es la única forma real de dejar constancia de que
    // ese club jugó esa temporada. Se resuelve siempre, tanto si la temporada es nueva como si ya
    // existía (antes esto se saltaba por completo cuando la temporada ya existía -- gap real
    // encontrado al diseñar esta captura).
    if (payload.participantTeamName) {
      const team = await this.matcher.matchTeam(payload.participantTeamName, payload.participantTeamCountry);
      if (team.verdict === 'same' && team.matchedEntityId) {
        try { await this.seasons.addTeam(seasonId, team.matchedEntityId); } catch { /* ya vinculado */ }
      }
    }

    return seasonId;
  }

  private async commitTeam(item: StagingItemRow, payload: { name: string; country?: string; city?: string }): Promise<number> {
    if (item.matchVerdict === 'same' && item.matchedEntityId) return item.matchedEntityId;
    const created = await this.teams.create({ name: payload.name, country: payload.country, city: payload.city } as any);
    await this.recordProvenance(item, 'team', created.id, { name: payload.name, country: payload.country, city: payload.city });
    return created.id;
  }

  private async commitVenue(item: StagingItemRow, payload: { name: string; city?: string; country?: string }): Promise<number> {
    if (item.matchVerdict === 'same' && item.matchedEntityId) return item.matchedEntityId;
    const created = await this.venues.create({ name: payload.name, city: payload.city, country: payload.country } as any);
    await this.recordProvenance(item, 'venue', created.id, { name: payload.name, city: payload.city, country: payload.country });
    return created.id;
  }

  private async commitPlayer(item: StagingItemRow, payload: { firstName: string; lastName: string; dateOfBirth?: string; nationality?: string; position?: string }): Promise<number> {
    if (item.matchVerdict === 'same' && item.matchedEntityId) {
      await this.enrich('players', item.matchedEntityId, payload, ['dateOfBirth', 'nationality', 'position']);
      return item.matchedEntityId;
    }
    const created = await this.players.create({ firstName: payload.firstName, lastName: payload.lastName, dateOfBirth: payload.dateOfBirth, nationality: payload.nationality, position: payload.position } as any);
    await this.recordProvenance(item, 'player', created.id, payload as Record<string, unknown>);
    return created.id;
  }

  private async commitOfficial(item: StagingItemRow, payload: { firstName: string; lastName: string; dateOfBirth?: string; nationality?: string; officialTypeName?: string }): Promise<number | null> {
    if (item.matchVerdict === 'same' && item.matchedEntityId) {
      await this.enrich('officials', item.matchedEntityId, payload, ['dateOfBirth', 'nationality']);
      return item.matchedEntityId;
    }
    const typeId = (await this.resolveOfficialTypeId(payload.officialTypeName)) ?? (await this.resolveOfficialTypeId('Otro'));
    if (!typeId) {
      await this.staging.setError(item.id, 'No se pudo resolver un tipo de oficial (ni el indicado ni "Otro")');
      return null;
    }
    const created = await this.officials.create({ firstName: payload.firstName, lastName: payload.lastName, officialTypeId: typeId, dateOfBirth: payload.dateOfBirth, nationality: payload.nationality } as any);
    await this.recordProvenance(item, 'official', created.id, payload as Record<string, unknown>);
    return created.id;
  }

  private async commitCoach(item: StagingItemRow, payload: { firstName: string; lastName: string; nationality?: string }): Promise<number> {
    if (item.matchVerdict === 'same' && item.matchedEntityId) {
      await this.enrich('coaches', item.matchedEntityId, payload, ['nationality']);
      return item.matchedEntityId;
    }
    const created = await this.coaches.create({ firstName: payload.firstName, lastName: payload.lastName, nationality: payload.nationality } as any);
    await this.recordProvenance(item, 'coach', created.id, payload as Record<string, unknown>);
    return created.id;
  }

  // --- Relaciones/eventos: dependencias resueltas por búsqueda estricta contra producción,
  // idempotencia por existencia antes de insertar (mismo patrón que linkClub() ya usa hoy) ---

  private async commitPlayerTeamHistory(item: StagingItemRow, payload: any): Promise<number | null> {
    const playerId = await this.findPlayerId(payload.playerFirstName, payload.playerLastName, payload.playerDateOfBirth);
    if (!playerId) return this.missingDependency(item, `Jugador "${payload.playerFirstName} ${payload.playerLastName}" no encontrado`);
    const teamMatch = await this.matcher.matchTeam(payload.teamName, payload.teamCountry);
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId) return this.missingDependency(item, `Equipo "${payload.teamName}" no encontrado`);
    const teamId = teamMatch.matchedEntityId;

    let seasonId: number | null = null;
    if (payload.competitionName && payload.seasonStartYear) {
      const comp = await this.matcher.matchCompetition(payload.competitionName, payload.teamCountry);
      if (comp.verdict === 'same' && comp.matchedEntityId) {
        const seasonRow = await this.pool.request().input('c', sql.Int, comp.matchedEntityId).input('y', sql.SmallInt, payload.seasonStartYear).query(
          'SELECT id FROM dbo.seasons WHERE competition_id = @c AND start_year = @y',
        );
        seasonId = seasonRow.recordset[0]?.id ?? null;
        if (seasonId) {
          try { await this.seasons.addTeam(seasonId, teamId); } catch { /* ya vinculado */ }
        }
      }
    }

    const startDate = payload.startDate ?? (payload.seasonStartYear ? `${payload.seasonStartYear}-01-01` : new Date().toISOString().slice(0, 10));

    // Idempotencia por (jugador, equipo, fecha de inicio) -- NO sólo (jugador, equipo). Bug real
    // encontrado en la corrida masiva: un jugador con varias campañas reales en el mismo club a lo
    // largo de los años (común -- una carrera de 10 años en un mismo equipo, cada año su propia fila
    // capturada con su propia temporada real) colapsaba a UNA sola fila porque el chequeo anterior
    // sólo miraba jugador+equipo, ignorando que cada año es una relación real distinta con su propia
    // season_id -- 1217 campañas reales capturadas quedaron en sólo 382 filas antes de este fix.
    const existing = await this.pool.request().input('p', sql.Int, playerId).input('t', sql.Int, teamId).input('start', sql.Date, startDate).query(
      'SELECT TOP 1 id FROM dbo.player_team_history WHERE player_id = @p AND team_id = @t AND start_date = @start',
    );
    if (existing.recordset.length > 0) {
      if (seasonId) {
        await this.pool.request().input('id', sql.Int, existing.recordset[0].id).input('s', sql.Int, seasonId).query(
          'UPDATE dbo.player_team_history SET season_id = COALESCE(season_id, @s) WHERE id = @id',
        );
      }
      return existing.recordset[0].id;
    }
    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();
    try {
      if (!payload.endDate) {
        await new sql.Request(transaction).input('p', sql.Int, playerId).input('end', sql.Date, startDate).query(
          `UPDATE dbo.player_team_history SET end_date = @end, updated_at = SYSUTCDATETIME() WHERE player_id = @p AND end_date IS NULL`,
        );
      }
      const inserted = await new sql.Request(transaction)
        .input('p', sql.Int, playerId).input('t', sql.Int, teamId).input('s', sql.Int, seasonId)
        .input('start', sql.Date, startDate).input('end', sql.Date, payload.endDate ?? null).input('num', sql.SmallInt, payload.squadNumber ?? null)
        .query(
          `INSERT INTO dbo.player_team_history (player_id, team_id, season_id, start_date, end_date, squad_number)
           OUTPUT INSERTED.id VALUES (@p, @t, @s, @start, @end, @num)`,
        );
      await transaction.commit();
      const id = inserted.recordset[0].id;
      await this.recordProvenance(item, 'player_team_history', id, { team: payload.teamName, season: String(payload.seasonStartYear ?? '') });
      return id;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  private async commitCoachTeamHistory(item: StagingItemRow, payload: any): Promise<number | null> {
    const coachMatch = await this.matcher.matchPerson('coach', payload.coachFirstName, payload.coachLastName, undefined, payload.coachNationality);
    if (coachMatch.verdict !== 'same' || !coachMatch.matchedEntityId) return this.missingDependency(item, `Técnico "${payload.coachFirstName} ${payload.coachLastName}" no encontrado`);
    const teamMatch = await this.matcher.matchTeam(payload.teamName, payload.teamCountry);
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId) return this.missingDependency(item, `Equipo "${payload.teamName}" no encontrado`);

    const existing = await this.pool.request().input('c', sql.Int, coachMatch.matchedEntityId).input('t', sql.Int, teamMatch.matchedEntityId).query(
      'SELECT TOP 1 id FROM dbo.coach_team_history WHERE coach_id = @c AND team_id = @t',
    );
    if (existing.recordset.length > 0) return existing.recordset[0].id;

    const startDate = payload.startDate ?? (payload.seasonStartYear ? `${payload.seasonStartYear}-01-01` : new Date().toISOString().slice(0, 10));
    if (!payload.endDate) {
      await this.pool.request().input('c', sql.Int, coachMatch.matchedEntityId).input('end', sql.Date, startDate).query(
        `UPDATE dbo.coach_team_history SET end_date = @end, updated_at = SYSUTCDATETIME() WHERE coach_id = @c AND end_date IS NULL`,
      );
    }
    let seasonId: number | null = null;
    if (payload.seasonStartYear) {
      const seasonRow = await this.pool.request().input('t', sql.Int, teamMatch.matchedEntityId).input('y', sql.SmallInt, payload.seasonStartYear).query(
        `SELECT TOP 1 s.id FROM dbo.seasons s JOIN dbo.season_teams st ON st.season_id = s.id WHERE st.team_id = @t AND s.start_year = @y`,
      );
      seasonId = seasonRow.recordset[0]?.id ?? null;
    }
    const inserted = await this.pool
      .request()
      .input('c', sql.Int, coachMatch.matchedEntityId).input('t', sql.Int, teamMatch.matchedEntityId).input('s', sql.Int, seasonId)
      .input('start', sql.Date, startDate).input('end', sql.Date, payload.endDate ?? null)
      .query(`INSERT INTO dbo.coach_team_history (coach_id, team_id, season_id, start_date, end_date) OUTPUT INSERTED.id VALUES (@c, @t, @s, @start, @end)`);
    return inserted.recordset[0].id;
  }

  private async commitMatch(item: StagingItemRow, payload: any): Promise<number | null> {
    const ref: MatchRef = payload.ref;
    const comp = await this.matcher.matchCompetition(ref.competitionName, ref.competitionCountry);
    if (comp.verdict !== 'same' || !comp.matchedEntityId) return this.missingDependency(item, `Competición "${ref.competitionName}" no encontrada`);
    const home = await this.matcher.matchTeam(ref.homeTeamName, ref.homeTeamCountry);
    const away = await this.matcher.matchTeam(ref.awayTeamName, ref.awayTeamCountry);
    if (home.verdict !== 'same' || !home.matchedEntityId) return this.missingDependency(item, `Equipo local "${ref.homeTeamName}" no encontrado`);
    if (away.verdict !== 'same' || !away.matchedEntityId) return this.missingDependency(item, `Equipo visitante "${ref.awayTeamName}" no encontrado`);

    let seasonId: number | null = null;
    if (ref.seasonStartYear) {
      const seasonRow = await this.pool.request().input('c', sql.Int, comp.matchedEntityId).input('y', sql.SmallInt, ref.seasonStartYear).query(
        'SELECT id FROM dbo.seasons WHERE competition_id = @c AND start_year = @y',
      );
      seasonId = seasonRow.recordset[0]?.id ?? null;
    }
    if (!seasonId) return this.missingDependency(item, `Temporada ${ref.seasonStartYear ?? '(?)'} de "${ref.competitionName}" no encontrada`);

    // El estadio se busca acotado por el país del equipo LOCAL -- es donde suele jugarse, aunque en
    // una competición continental el "local" del partido puntual puede no serlo siempre; sigue
    // siendo el mejor indicio real disponible sin inventar un país propio para el estadio.
    let venueId: number | null = null;
    if (payload.venueName) {
      const v = await this.matcher.matchVenue(payload.venueName, undefined, ref.homeTeamCountry);
      venueId = v.verdict === 'same' ? v.matchedEntityId : null;
    }

    // Identidad de partido (regla del plan: competición+temporada+fecha+equipos -- ya existente = enriquecer, no duplicar).
    const existing = await this.pool
      .request()
      .input('c', sql.Int, comp.matchedEntityId).input('s', sql.Int, seasonId).input('d', sql.Date, ref.matchDate)
      .input('h', sql.Int, home.matchedEntityId).input('a', sql.Int, away.matchedEntityId)
      .query(`SELECT id FROM dbo.matches WHERE competition_id = @c AND season_id = @s AND match_date = @d AND home_team_id = @h AND away_team_id = @a`);

    let matchId: number;
    if (existing.recordset.length > 0) {
      matchId = existing.recordset[0].id;
      if (venueId) await this.pool.request().input('id', sql.Int, matchId).input('v', sql.Int, venueId).query('UPDATE dbo.matches SET venue_id = COALESCE(venue_id, @v) WHERE id = @id');
      if (payload.phase) await this.pool.request().input('id', sql.Int, matchId).input('p', sql.NVarChar, payload.phase).query('UPDATE dbo.matches SET phase = COALESCE(phase, @p) WHERE id = @id');
      if (payload.attendance) await this.pool.request().input('id', sql.Int, matchId).input('att', sql.Int, payload.attendance).query('UPDATE dbo.matches SET attendance = COALESCE(attendance, @att) WHERE id = @id');
    } else {
      const created = await this.matches.create(
        { competitionId: comp.matchedEntityId, seasonId, homeTeamId: home.matchedEntityId, awayTeamId: away.matchedEntityId, matchDate: ref.matchDate, venueId, status: 'finished', round: payload.round, phase: payload.phase, attendance: payload.attendance } as any,
        { ip: 'migration-engine', userAgent: 'migration-engine' } as any,
        null,
      );
      matchId = created.id;
      await this.recordProvenance(item, 'match', matchId, { competition: ref.competitionName, date: ref.matchDate });
    }

    if (payload.homeScore !== undefined && payload.awayScore !== undefined) {
      try {
        await this.matches.setPeriodScore(matchId, { period: 'full_time', homeScore: payload.homeScore, awayScore: payload.awayScore } as any, { ip: 'migration-engine', userAgent: 'migration-engine' } as any, null);
      } catch { /* ya tiene marcador cargado -- no se pisa (regla del plan: nunca sobrescribir ciegamente) */ }
    }

    for (const ref2 of payload.officials ?? []) {
      const officialMatch = await this.matcher.matchPerson('official', ref2.firstName, ref2.lastName);
      if (officialMatch.verdict === 'same' && officialMatch.matchedEntityId) {
        try { await this.matchParticipants.addOfficial(matchId, { officialId: officialMatch.matchedEntityId, role: ref2.role } as any); } catch { /* ya cargado */ }
      }
    }
    for (const ref3 of payload.coaches ?? []) {
      const coachMatch = await this.matcher.matchPerson('coach', ref3.firstName, ref3.lastName);
      const teamMatch = ref3.teamName === ref.homeTeamName ? home : ref3.teamName === ref.awayTeamName ? away : null;
      if (coachMatch.verdict === 'same' && coachMatch.matchedEntityId && teamMatch?.matchedEntityId) {
        try { await this.matchParticipants.addCoach(matchId, { teamId: teamMatch.matchedEntityId, coachId: coachMatch.matchedEntityId } as any); } catch { /* ya cargado */ }
      }
    }

    return matchId;
  }

  private async commitLineup(item: StagingItemRow, payload: any): Promise<number | null> {
    const matchId = await this.resolveMatchId(payload.matchRef);
    if (!matchId) return this.missingDependency(item, 'Partido no encontrado -- migrar la Fase 9 primero');
    const teamMatch = await this.matcher.matchTeam(payload.teamName, this.teamCountryFor(payload.matchRef, payload.teamName));
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId) return this.missingDependency(item, `Equipo "${payload.teamName}" no encontrado`);
    const playerId = await this.findPlayerId(payload.playerFirstName, payload.playerLastName);
    if (!playerId) return this.missingDependency(item, `Jugador "${payload.playerFirstName} ${payload.playerLastName}" no encontrado`);
    try {
      const result = await this.matchParticipants.addLineupEntry(matchId, {
        teamId: teamMatch.matchedEntityId, playerId, isStarting: payload.isStarting, shirtNumber: payload.shirtNumber, position: payload.position, minutesPlayed: payload.minutesPlayed,
      } as any);
      return result.id;
    } catch {
      return null; // UX_ml_match_player -- ya cargado, no es un error real
    }
  }

  private async commitGoal(item: StagingItemRow, payload: any): Promise<number | null> {
    const matchId = await this.resolveMatchId(payload.matchRef);
    if (!matchId) return this.missingDependency(item, 'Partido no encontrado -- migrar la Fase 9 primero');
    const teamMatch = await this.matcher.matchTeam(payload.teamName, this.teamCountryFor(payload.matchRef, payload.teamName));
    const playerId = await this.findPlayerId(payload.playerFirstName, payload.playerLastName);
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId || !playerId) return this.missingDependency(item, 'Equipo o jugador del gol no encontrado');
    let assistPlayerId: number | undefined;
    if (payload.assistFirstName && payload.assistLastName) assistPlayerId = (await this.findPlayerId(payload.assistFirstName, payload.assistLastName)) ?? undefined;
    const result = await this.matchEvents.addGoal(matchId, { teamId: teamMatch.matchedEntityId, playerId, assistPlayerId, minute: payload.minute, ownGoal: payload.ownGoal, penalty: payload.penalty } as any);
    return result.id;
  }

  private async commitCard(item: StagingItemRow, payload: any): Promise<number | null> {
    const matchId = await this.resolveMatchId(payload.matchRef);
    if (!matchId) return this.missingDependency(item, 'Partido no encontrado -- migrar la Fase 9 primero');
    const teamMatch = await this.matcher.matchTeam(payload.teamName, this.teamCountryFor(payload.matchRef, payload.teamName));
    const playerId = await this.findPlayerId(payload.playerFirstName, payload.playerLastName);
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId || !playerId) return this.missingDependency(item, 'Equipo o jugador de la tarjeta no encontrado');
    const result = await this.matchEvents.addCard(matchId, { teamId: teamMatch.matchedEntityId, playerId, cardType: payload.cardType, minute: payload.minute, reason: payload.reason } as any);
    return result.id;
  }

  private async commitPenalty(item: StagingItemRow, payload: any): Promise<number | null> {
    const matchId = await this.resolveMatchId(payload.matchRef);
    if (!matchId) return this.missingDependency(item, 'Partido no encontrado -- migrar la Fase 9 primero');
    const teamMatch = await this.matcher.matchTeam(payload.teamName, this.teamCountryFor(payload.matchRef, payload.teamName));
    const playerId = await this.findPlayerId(payload.playerFirstName, payload.playerLastName);
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId || !playerId) return this.missingDependency(item, 'Equipo o jugador del penal no encontrado');
    const result = await this.matchEvents.addPenaltyKick(matchId, { teamId: teamMatch.matchedEntityId, playerId, outcome: payload.outcome, minute: payload.minute } as any);
    return result.id;
  }

  private async commitMatchTeamStats(item: StagingItemRow, payload: any): Promise<number | null> {
    const matchId = await this.resolveMatchId(payload.matchRef);
    if (!matchId) return this.missingDependency(item, 'Partido no encontrado -- migrar la Fase 9 primero');
    const teamMatch = await this.matcher.matchTeam(payload.teamName, this.teamCountryFor(payload.matchRef, payload.teamName));
    if (teamMatch.verdict !== 'same' || !teamMatch.matchedEntityId) return this.missingDependency(item, `Equipo "${payload.teamName}" no encontrado`);
    await this.pool
      .request()
      .input('m', sql.Int, matchId).input('t', sql.Int, teamMatch.matchedEntityId).input('poss', sql.Decimal(5, 2), payload.possessionPct ?? null)
      .input('shots', sql.Int, payload.shots ?? null).input('sot', sql.Int, payload.shotsOnTarget ?? null).input('corners', sql.Int, payload.corners ?? null).input('fouls', sql.Int, payload.fouls ?? null)
      .query(
        `MERGE dbo.match_team_stats AS target
         USING (SELECT @m AS match_id, @t AS team_id) AS src ON target.match_id = src.match_id AND target.team_id = src.team_id
         WHEN MATCHED THEN UPDATE SET possession_pct = COALESCE(target.possession_pct, @poss), shots = COALESCE(target.shots, @shots), shots_on_target = COALESCE(target.shots_on_target, @sot), corners = COALESCE(target.corners, @corners), fouls = COALESCE(target.fouls, @fouls), updated_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (match_id, team_id, possession_pct, shots, shots_on_target, corners, fouls, data_source, updated_at)
           VALUES (@m, @t, @poss, @shots, @sot, @corners, @fouls, 'registrofutbol', SYSUTCDATETIME());`,
      );
    return matchId;
  }

  // --- Helpers compartidos ---

  // El equipo que figura en un gol/tarjeta/alineación/etc. es siempre local o visitante del propio
  // matchRef -- se deriva su país real de ahí en vez de depender de un país compartido inexistente
  // (ver el comentario en types.ts sobre por qué MatchRef ya no tiene un solo `country`).
  private teamCountryFor(ref: MatchRef, teamName: string): string {
    return teamName === ref.awayTeamName ? ref.awayTeamCountry : ref.homeTeamCountry;
  }

  private async resolveMatchId(ref: MatchRef): Promise<number | null> {
    const comp = await this.matcher.matchCompetition(ref.competitionName, ref.competitionCountry);
    if (comp.verdict !== 'same' || !comp.matchedEntityId) return null;
    const home = await this.matcher.matchTeam(ref.homeTeamName, ref.homeTeamCountry);
    const away = await this.matcher.matchTeam(ref.awayTeamName, ref.awayTeamCountry);
    if (home.verdict !== 'same' || !home.matchedEntityId || away.verdict !== 'same' || !away.matchedEntityId) return null;
    const request = this.pool.request().input('c', sql.Int, comp.matchedEntityId).input('d', sql.Date, ref.matchDate).input('h', sql.Int, home.matchedEntityId).input('a', sql.Int, away.matchedEntityId);
    const result = await request.query('SELECT id FROM dbo.matches WHERE competition_id = @c AND match_date = @d AND home_team_id = @h AND away_team_id = @a');
    return result.recordset[0]?.id ?? null;
  }

  private async findPlayerId(firstName: string, lastName: string, dateOfBirth?: string): Promise<number | null> {
    const m = await this.matcher.matchPerson('player', firstName, lastName, dateOfBirth);
    return m.verdict === 'same' ? m.matchedEntityId : null;
  }

  private async resolveOfficialTypeId(name?: string): Promise<number | null> {
    if (!name) return null;
    const all = await this.pool.request().query('SELECT id, name FROM dbo.official_types');
    const target = normalizeText(name);
    return all.recordset.find((r: any) => normalizeText(r.name) === target)?.id ?? null;
  }

  private async missingDependency(item: StagingItemRow, message: string): Promise<null> {
    await this.staging.setError(item.id, message);
    await this.tracker.log(item.syncRunId, 'warning', message, item.entityType);
    return null;
  }

  // Sólo se completa lo que está vacío -- nunca pisa un valor existente (el contradictorio ya quedó
  // como field_diff en ReconciliationService, antes de llegar acá).
  private async enrich(table: string, id: number, payload: Record<string, any>, fields: string[]) {
    const columnByField: Record<string, string> = { dateOfBirth: 'date_of_birth', nationality: 'nationality', position: 'position' };
    for (const field of fields) {
      const value = payload[field];
      if (value === undefined || value === null || value === '') continue;
      const column = columnByField[field] ?? field;
      await this.pool.request().input('id', sql.Int, id).input('v', sql.NVarChar, String(value)).query(
        `UPDATE dbo.${table} SET ${column} = COALESCE(${column}, @v) WHERE id = @id`,
      );
    }
  }

  private async recordProvenance(item: StagingItemRow, entityType: string, entityId: number, fields: Record<string, unknown>) {
    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') continue;
      await this.provenance.recordField({
        entityType, entityId, fieldName, fieldValue: fieldValue as string,
        sourceName: SOURCE_NAME, sourceUrl: item.sourceRef ?? undefined, syncRunId: item.syncRunId,
      });
    }
  }
}
