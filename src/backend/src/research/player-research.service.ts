import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { CompetitionsService } from '../competitions/competitions.service';
import { PlayersService } from '../players/players.service';
import { SeasonsService } from '../seasons/seasons.service';
import { TeamsService } from '../teams/teams.service';
import { SyncRunTracker } from '../import-engine/sync-run-tracker.service';
import { SubmitResearchedPlayerDto, ResearchedClubStintDto } from './dto/submit-researched-player.dto';
import { bestMatch, normalizeText, PersonCandidate } from './name-match.util';
import { PhotoAcquisitionService } from './photo-acquisition.service';
import { ProvenanceService } from './provenance.service';

export interface PlayerResearchResult {
  status: 'new' | 'updated' | 'unchanged' | 'conflict';
  playerId?: number;
  fieldsUpdated?: string[];
  clubsLinked?: number;
  photoAcquired?: boolean;
}

const ENRICHABLE_FIELDS: Array<keyof SubmitResearchedPlayerDto> = [
  'dateOfBirth',
  'birthPlace',
  'nationality',
  'position',
  'heightCm',
  'preferredFoot',
];

// Investiga UN jugador ya encontrado por el motor (agente) y lo relaciona con LeagueCore:
// identifica si ya existe (multi-atributo, nunca sólo por nombre), crea o enriquece, vincula
// historial de clubes real (equipo global + participación real en competición/temporada vía
// season_teams, mismo modelo ya corregido esta sesión), descarga foto verificada, y registra
// procedencia. Nunca borra un valor existente -- si el dato nuevo contradice al actual, queda
// registrado como conflicto de campo en vez de pisarlo.
@Injectable()
export class PlayerResearchService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly players: PlayersService,
    private readonly teams: TeamsService,
    private readonly competitions: CompetitionsService,
    private readonly seasons: SeasonsService,
    private readonly tracker: SyncRunTracker,
    private readonly photos: PhotoAcquisitionService,
    private readonly provenance: ProvenanceService,
  ) {}

  async submit(runId: number, input: SubmitResearchedPlayerDto): Promise<PlayerResearchResult> {
    await this.tracker.bumpCounter(runId, 'total_analyzed');
    const label = `${input.firstName} ${input.lastName}`;

    const candidates = await this.loadCandidates();
    const { verdict, best } = bestMatch(
      { firstName: input.firstName, lastName: input.lastName, dateOfBirth: input.dateOfBirth, nationality: input.nationality, extra: input.position },
      candidates,
    );

    if (verdict === 'ambiguous' && best) {
      await this.tracker.bumpCounter(runId, 'total_conflicts');
      await this.tracker.recordConflict(runId, 'player', best.candidate.id, input.externalId ?? input.sourceUrl, label, best.score, {
        dateOfBirth: input.dateOfBirth ?? null,
        nationality: input.nationality ?? null,
        sourceUrl: input.sourceUrl,
      });
      await this.tracker.log(runId, 'warning', `Posible duplicado (${best.score}%): ${label}`, 'player', label);
      return { status: 'conflict' };
    }

    let playerId: number;
    let fieldsUpdated: string[] = [];

    if (verdict === 'same_person' && best) {
      playerId = best.candidate.id;
      fieldsUpdated = await this.enrich(runId, playerId, input);
      if (fieldsUpdated.length > 0) {
        await this.tracker.bumpCounter(runId, 'total_updated');
        await this.tracker.log(runId, 'success', `Jugador enriquecido (${fieldsUpdated.join(', ')}): ${label}`, 'player', label);
      } else {
        await this.tracker.bumpCounter(runId, 'total_unchanged');
        await this.tracker.log(runId, 'info', `Jugador ya identificado, sin datos nuevos: ${label}`, 'player', label);
      }
    } else {
      const created = await this.players.create({
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        birthPlace: input.birthPlace,
        nationality: input.nationality,
        position: input.position,
        heightCm: input.heightCm,
        preferredFoot: input.preferredFoot,
      } as any);
      playerId = created.id;
      await this.tracker.bumpCounter(runId, 'total_new');
      await this.tracker.log(runId, 'success', `Jugador nuevo: ${label}`, 'player', label);
    }

    await this.setProvenance(runId, playerId, input);

    let clubsLinked = 0;
    for (const club of input.clubs ?? []) {
      const linked = await this.linkClub(runId, playerId, club, input);
      if (linked) clubsLinked++;
    }

    let photoAcquired = false;
    if (input.photoUrl) {
      const currentPhoto = await this.pool.request().input('id', sql.Int, playerId).query('SELECT photo_url FROM dbo.players WHERE id = @id');
      const hasPhoto = !!currentPhoto.recordset[0]?.photo_url;
      if (!hasPhoto) {
        const localUrl = await this.photos.acquire('players', input.photoUrl);
        if (localUrl) {
          await this.players.update(playerId, { photoUrl: localUrl } as any);
          photoAcquired = true;
          const photoSource = input.fieldSources?.photoUrl ?? { sourceName: input.sourceName, sourceUrl: input.sourceUrl };
          await this.provenance.recordField({
            entityType: 'player',
            entityId: playerId,
            fieldName: 'photoUrl',
            fieldValue: input.photoUrl,
            sourceName: photoSource.sourceName,
            sourceUrl: photoSource.sourceUrl,
            syncRunId: runId,
          });
          await this.tracker.log(runId, 'success', `Fotografía obtenida: ${label}`, 'player', label);
        } else {
          await this.tracker.log(runId, 'warning', `Fotografía no pudo descargarse/validarse: ${label}`, 'player', label);
        }
      }
    }

    return { status: verdict === 'same_person' ? (fieldsUpdated.length > 0 ? 'updated' : 'unchanged') : 'new', playerId, fieldsUpdated, clubsLinked, photoAcquired };
  }

  private async loadCandidates(): Promise<PersonCandidate[]> {
    const result = await this.pool
      .request()
      .query('SELECT id, first_name, last_name, date_of_birth, nationality, position FROM dbo.players');
    return result.recordset.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      dateOfBirth: r.date_of_birth,
      nationality: r.nationality,
      extra: r.position,
    }));
  }

  private async enrich(runId: number, playerId: number, input: SubmitResearchedPlayerDto): Promise<string[]> {
    const current = await this.players.getById(playerId);
    const patch: Record<string, unknown> = {};
    const updated: string[] = [];

    for (const field of ENRICHABLE_FIELDS) {
      const newVal = input[field];
      if (newVal === undefined || newVal === null || newVal === '') continue;
      const oldVal = (current as any)[field];
      if (oldVal === undefined || oldVal === null || oldVal === '') {
        patch[field] = newVal;
        updated.push(field);
        continue;
      }
      const oldStr = field === 'dateOfBirth' ? String(oldVal).slice(0, 10) : normalizeText(String(oldVal));
      const newStr = field === 'dateOfBirth' ? String(newVal).slice(0, 10) : normalizeText(String(newVal));
      if (oldStr !== newStr) {
        await this.tracker.recordFieldDiffConflict(
          runId,
          'player',
          playerId,
          { [field]: oldVal },
          { [field]: newVal },
          { [field]: newVal },
        );
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.players.update(playerId, patch as any);
    }
    return updated;
  }

  private async setProvenance(runId: number, playerId: number, input: SubmitResearchedPlayerDto) {
    // dbo.players.external_source es NVARCHAR(50) (migración 011, pensado para un código corto de
    // fuente tipo 'wikipedia', no una cita completa) -- se trunca defensivamente para nunca fallar
    // por un sourceName más descriptivo; la cita completa igual queda en external_url. Esta columna
    // plana sigue existiendo (compatibilidad hacia atrás) pero deja de ser la ÚNICA procedencia:
    // dbo.field_provenance registra la fuente real de CADA campo por separado (Decisión 3).
    await this.pool
      .request()
      .input('id', sql.Int, playerId)
      .input('data_origin', sql.NVarChar, 'research')
      .input('external_source', sql.NVarChar, input.sourceName.slice(0, 50))
      .input('external_id', sql.NVarChar, input.externalId ?? null)
      .input('external_url', sql.NVarChar, input.sourceUrl)
      .query(
        `UPDATE dbo.players
         SET data_origin = CASE WHEN data_origin = 'manual' THEN @data_origin ELSE data_origin END,
             external_source = COALESCE(external_source, @external_source),
             external_id = COALESCE(external_id, @external_id),
             external_url = COALESCE(external_url, @external_url),
             last_synced_at = SYSUTCDATETIME()
         WHERE id = @id`,
      );

    for (const field of ENRICHABLE_FIELDS) {
      const value = input[field];
      if (value === undefined || value === null || value === ('' as any)) continue;
      const src = input.fieldSources?.[field] ?? { sourceName: input.sourceName, sourceUrl: input.sourceUrl };
      await this.provenance.recordField({
        entityType: 'player',
        entityId: playerId,
        fieldName: field,
        fieldValue: value as string | number,
        sourceName: src.sourceName,
        sourceUrl: src.sourceUrl,
        syncRunId: runId,
      });
    }

    if (input.externalId) {
      await this.provenance.recordExternalId({
        entityType: 'player',
        entityId: playerId,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        externalId: input.externalId,
      });
    }
    for (const extra of input.additionalSources ?? []) {
      if (!extra.externalId) continue;
      await this.provenance.recordExternalId({
        entityType: 'player',
        entityId: playerId,
        sourceName: extra.sourceName,
        sourceUrl: extra.sourceUrl,
        externalId: extra.externalId,
      });
    }
  }

  private async linkClub(runId: number, playerId: number, club: ResearchedClubStintDto, input: SubmitResearchedPlayerDto): Promise<boolean> {
    const teamId = await this.resolveOrCreateTeam(club.teamName, club.country);
    if (!teamId) return false;

    let seasonId: number | null = null;
    if (club.competitionName && club.seasonYear) {
      const competitionId = await this.resolveOrCreateCompetition(club.competitionName, club.country);
      if (competitionId) {
        seasonId = await this.resolveOrCreateSeason(competitionId, club.seasonYear);
        try {
          await this.seasons.addTeam(seasonId, teamId);
        } catch {
          // ya vinculado -- no es un error, es el caso esperado en investigaciones repetidas
        }
      }
    }

    const existing = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('team_id', sql.Int, teamId)
      .query('SELECT TOP 1 id FROM dbo.player_team_history WHERE player_id = @player_id AND team_id = @team_id');
    if (existing.recordset.length > 0) {
      if (seasonId) {
        await this.pool
          .request()
          .input('id', sql.Int, existing.recordset[0].id)
          .input('season_id', sql.Int, seasonId)
          .query('UPDATE dbo.player_team_history SET season_id = COALESCE(season_id, @season_id) WHERE id = @id');
      }
      return false;
    }

    const startDate = club.startDate ?? (club.seasonYear ? `${club.seasonYear}-01-01` : null);
    const endDate = club.endDate ?? null;

    // dbo.player_team_history sólo permite UN paso "abierto" (end_date NULL) por jugador a la vez
    // (UX_pth_player_open_stint, migración 011). Un jugador histórico con varios clubes reales sin
    // fecha de fin exacta documentada violaría esa restricción si cada club llegara con end_date
    // NULL -- se cierra defensivamente cualquier paso abierto anterior (con la fecha de inicio del
    // nuevo, igual que ya hace PlayersService al cambiar de equipo actual) antes de insertar uno
    // nuevo sin fecha de fin.
    if (endDate === null) {
      await this.pool
        .request()
        .input('player_id', sql.Int, playerId)
        .input('end_date', sql.Date, startDate)
        .query(
          `UPDATE dbo.player_team_history
           SET end_date = COALESCE(@end_date, CAST(SYSUTCDATETIME() AS DATE)), updated_at = SYSUTCDATETIME()
           WHERE player_id = @player_id AND end_date IS NULL`,
        );
    }

    await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('team_id', sql.Int, teamId)
      .input('season_id', sql.Int, seasonId)
      .input('start_date', sql.Date, startDate)
      .input('end_date', sql.Date, endDate)
      .input('squad_number', sql.SmallInt, club.squadNumber ?? null)
      .query(
        `INSERT INTO dbo.player_team_history (player_id, team_id, season_id, start_date, end_date, squad_number)
         VALUES (@player_id, @team_id, @season_id, COALESCE(@start_date, CAST(SYSUTCDATETIME() AS DATE)), @end_date, @squad_number)`,
      );
    const clubSource = club.sourceName && club.sourceUrl ? { sourceName: club.sourceName, sourceUrl: club.sourceUrl } : { sourceName: input.sourceName, sourceUrl: input.sourceUrl };
    await this.provenance.recordField({
      entityType: 'player',
      entityId: playerId,
      fieldName: club.seasonYear ? `club_${club.seasonYear}` : 'club',
      fieldValue: club.teamName,
      sourceName: clubSource.sourceName,
      sourceUrl: clubSource.sourceUrl,
      syncRunId: runId,
    });

    await this.tracker.log(runId, 'success', `Relacionado con ${club.teamName}${club.seasonYear ? ` (${club.seasonYear})` : ''}`, 'player');
    return true;
  }

  private async resolveOrCreateTeam(name: string, country?: string): Promise<number | null> {
    const request = this.pool.request().input('name', sql.NVarChar, name.trim());
    let query = 'SELECT TOP 1 id FROM dbo.teams WHERE name = @name';
    if (country) {
      request.input('country', sql.NVarChar, country);
      query += ' AND (country = @country OR country IS NULL)';
    }
    const existing = await request.query(query);
    if (existing.recordset.length > 0) {
      if (country) {
        await this.pool
          .request()
          .input('id', sql.Int, existing.recordset[0].id)
          .input('country', sql.NVarChar, country)
          .query('UPDATE dbo.teams SET country = COALESCE(country, @country) WHERE id = @id');
      }
      return existing.recordset[0].id;
    }
    const created = await this.teams.create({ name: name.trim(), country } as any);
    return created.id;
  }

  private async resolveOrCreateCompetition(name: string, country?: string): Promise<number | null> {
    const list = await this.competitions.list({ search: name });
    const match = list.find((c: any) => normalizeText(c.name) === normalizeText(name));
    if (match) return match.id;
    const created = await this.competitions.create({ name: name.trim(), country, competitionType: 'league', sport: 'futbol' } as any);
    return created.id;
  }

  private async resolveOrCreateSeason(competitionId: number, year: number): Promise<number> {
    const existing = await this.pool
      .request()
      .input('competition_id', sql.Int, competitionId)
      .input('start_year', sql.SmallInt, year)
      .query('SELECT id FROM dbo.seasons WHERE competition_id = @competition_id AND start_year = @start_year');
    if (existing.recordset.length > 0) return existing.recordset[0].id;
    const created = await this.seasons.create({ competitionId, startYear: year } as any);
    return created.id;
  }
}
