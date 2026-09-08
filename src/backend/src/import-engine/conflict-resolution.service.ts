import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import type { RequestMeta } from '../auth/auth.service';
import { CompetitionsService } from '../competitions/competitions.service';
import { TeamsService } from '../teams/teams.service';
import { PlayersService } from '../players/players.service';
import { MatchesService } from '../matches/matches.service';
import { SyncRunsService } from './sync-runs.service';

// Motor genérico de resolución de conflictos -- hasta esta pieza, sync_conflicts sólo se LISTABA
// (nunca se podía actuar sobre ellos). Dos familias de acción según `conflict_kind`:
//   'duplicate_entity' (¿es la misma entidad o una distinta?): link_existing | create_new | skip
//   'field_diff' (misma entidad, algún campo distinto -- ej. resultado 2-1 vs 3-1):
//     keep_existing | use_imported | skip
// Cualquier conector (RSSSF/TheSportsDB/Ltrack/archivo, presentes y futuros) que registre un
// conflicto con SyncRunTracker pasa por acá para resolverse -- una sola pieza de resolución, no una
// por conector.
const DUPLICATE_ACTIONS = new Set(['link_existing', 'create_new', 'skip']);
const FIELD_DIFF_ACTIONS = new Set(['keep_existing', 'use_imported', 'skip']);
// official/venue/coach agregados para el motor de migración histórica (migration-engine/) -- gap
// real encontrado en el diseño: un conflicto de oficial duplicado no se podía resolver con
// "vincular con el existente" porque faltaba acá, pese a que sync_conflicts ya soporta
// entity_type='official' desde el motor de investigación.
const ALIAS_TABLES: Record<string, string> = { competition: 'competitions', team: 'teams', player: 'players', official: 'officials', venue: 'venues', coach: 'coaches' };

@Injectable()
export class ConflictResolutionService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly competitions: CompetitionsService,
    private readonly teams: TeamsService,
    private readonly players: PlayersService,
    private readonly matches: MatchesService,
    private readonly syncRuns: SyncRunsService,
  ) {}

  async resolve(conflictId: number, action: string, userId: number, meta: RequestMeta) {
    const row = await this.syncRuns.getConflictRow(conflictId);
    if (row.status !== 'pending') {
      throw new BadRequestException('Este conflicto ya fue resuelto');
    }

    if (row.conflict_kind === 'field_diff') {
      if (!FIELD_DIFF_ACTIONS.has(action)) throw new BadRequestException('Acción no válida para este conflicto');
      await this.resolveFieldDiff(row, action, userId, meta);
    } else {
      if (!DUPLICATE_ACTIONS.has(action)) throw new BadRequestException('Acción no válida para este conflicto');
      await this.resolveDuplicateEntity(row, action);
    }

    await this.pool
      .request()
      .input('id', sql.Int, conflictId)
      .input('action', sql.NVarChar, action)
      .input('user_id', sql.Int, userId)
      .query(
        `UPDATE dbo.sync_conflicts
         SET status = 'resolved', resolution_action = @action, resolved_at = SYSUTCDATETIME(), resolved_by_user_id = @user_id
         WHERE id = @id`,
      );
    return { message: 'Conflicto resuelto' };
  }

  // Aplica la misma acción a varios conflictos -- sigue de largo si uno falla individualmente
  // (ej. falta contexto para "crear como nuevo") en vez de abortar el resto, y reporta cuántos
  // realmente se resolvieron (§12: "CONSERVAR TODOS"/"REEMPLAZAR TODOS"/"OMITIR TODOS").
  async resolveBulk(conflictIds: number[], action: string, userId: number, meta: RequestMeta) {
    let resolved = 0;
    const failures: { id: number; message: string }[] = [];
    for (const id of conflictIds) {
      try {
        await this.resolve(id, action, userId, meta);
        resolved++;
      } catch (err: any) {
        failures.push({ id, message: err.message ?? 'Error desconocido' });
      }
    }
    return { resolved, total: conflictIds.length, failures };
  }

  private async resolveDuplicateEntity(row: Record<string, any>, action: string) {
    if (action === 'skip') return;

    if (action === 'link_existing') {
      if (!row.leaguecore_entity_id) throw new BadRequestException('No hay una entidad existente con la que vincular');
      const table = ALIAS_TABLES[row.entity_type];
      if (!table) throw new BadRequestException(`No se puede vincular un conflicto de tipo "${row.entity_type}"`);
      const runResult = await this.pool.request().input('run_id', sql.Int, row.sync_run_id).query('SELECT source_code FROM dbo.sync_runs WHERE id = @run_id');
      const sourceCode = runResult.recordset[0]?.source_code ?? null;
      await this.pool
        .request()
        .input('id', sql.Int, row.leaguecore_entity_id)
        .input('source', sql.NVarChar, sourceCode)
        .input('external_id', sql.NVarChar, row.external_id)
        .query(`UPDATE dbo.${table} SET external_source = @source, external_id = @external_id WHERE id = @id`);
      return;
    }

    if (action === 'create_new') {
      const context = row.context_json ? JSON.parse(row.context_json) : {};
      if (row.entity_type === 'competition') {
        // Idempotencia real antes de crear -- bug real encontrado migrando cientos de conflictos
        // por lote: si el mismo nombre exacto aparece en conflictos de VARIAS corridas distintas
        // (ej. "Copa Confederaciones", ambiguo contra "Copa Confederaciones Selección Chilena" cada
        // vez), resolver "crear como nuevo" en cada corrida creaba una fila duplicada por corrida
        // -- 3 filas idénticas reales encontradas antes de este fix. Un nombre EXACTO ya existente
        // se reutiliza en vez de duplicarse.
        const existing = await this.pool.request().input('name', sql.NVarChar, row.external_value).query('SELECT TOP 1 id FROM dbo.competitions WHERE name = @name');
        if (existing.recordset.length > 0) return;
        await this.competitions.create({ name: row.external_value, sport: 'Fútbol' } as any);
        return;
      }
      if (row.entity_type === 'team') {
        // Un club es una entidad independiente (§1/§21 del pedido de corrección arquitectónica) --
        // ya no hace falta ninguna competición destino para crearlo. Misma idempotencia que arriba.
        const existing = await this.pool.request().input('name', sql.NVarChar, row.external_value).query('SELECT TOP 1 id FROM dbo.teams WHERE name = @name');
        if (existing.recordset.length > 0) return;
        await this.teams.create({ name: row.external_value } as any);
        return;
      }
      if (row.entity_type === 'player') {
        // teamId es opcional de verdad -- dbo.players.team_id es NULL-able desde la migración 011
        // (agentes libres/jugadores sin vincular todavía). La excepción de acá era un requisito
        // defensivo que nunca hizo falta, y bloqueaba justo el caso real de un motor de migración
        // histórica creando una persona SIN un club resuelto todavía en esta corrida (su relación
        // jugador-equipo llega como un staging item aparte, no junto con el conflicto de identidad).
        const parts = String(row.external_value).trim().split(/\s+/);
        // Últimas 2 palabras = apellido para nombres de 3+ palabras (convención española real:
        // nombre[+segundo nombre] + apellido paterno + apellido materno), extendido hacia atrás
        // por conectores de apellido compuesto (ej. "Medel de La Fuente" -- sin esto "de"/"La" se
        // cortaban como si fueran parte del nombre de pila, produciendo un jugador real duplicado;
        // mismo fix aplicado en build_capture.js del motor de migración histórica).
        const CONNECTORS = new Set(['de', 'del', 'la', 'los', 'las', 'y']);
        let firstName: string;
        let lastName: string;
        if (parts.length <= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ') || parts[0];
        } else {
          let cut = parts.length - 1;
          while (cut > 0 && CONNECTORS.has(parts[cut - 1].toLowerCase())) cut--;
          if (cut > 1) cut--;
          if (cut < 1) cut = 1;
          firstName = parts.slice(0, cut).join(' ');
          lastName = parts.slice(cut).join(' ');
        }
        // Nacionalidad como desempate cuando está disponible -- bug real encontrado migrando:
        // dos jugadores reales distintos con el mismo nombre exacto ("Emilio Espinoza", Chile vs
        // Argentina) colapsaban en uno solo porque esta comprobación sólo miraba nombre+apellido,
        // reutilizando en silencio la fila existente en vez de crear la persona realmente distinta.
        const nationality: string | undefined = context.payload?.nationality;
        const existingPlayerRequest = this.pool.request().input('fn', sql.NVarChar, firstName).input('ln', sql.NVarChar, lastName);
        let existingPlayerQuery = 'SELECT TOP 1 id FROM dbo.players WHERE first_name = @fn AND last_name = @ln';
        if (nationality) {
          existingPlayerRequest.input('nat', sql.NVarChar, nationality);
          existingPlayerQuery += ' AND (nationality = @nat OR nationality IS NULL)';
        }
        const existingPlayer = await existingPlayerRequest.query(existingPlayerQuery);
        if (existingPlayer.recordset.length > 0) return;
        await this.players.create({ firstName, lastName, nationality, teamId: context.teamId ?? null } as any);
        return;
      }
      throw new BadRequestException(`No se puede crear automáticamente un conflicto de tipo "${row.entity_type}"`);
    }
  }

  private async resolveFieldDiff(row: Record<string, any>, action: string, userId: number, meta: RequestMeta) {
    if (action === 'keep_existing' || action === 'skip') return;

    // action === 'use_imported'
    const external = row.external_value ? JSON.parse(row.external_value) : null;
    const apply = external?.apply;
    if (!apply || !row.leaguecore_entity_id) throw new BadRequestException('No hay datos importados para aplicar');

    if (row.entity_type === 'match') {
      const { homeScore, awayScore, ...updateFields } = apply;
      if (Object.keys(updateFields).length > 0) {
        await this.matches.update(row.leaguecore_entity_id, updateFields, meta, userId);
      }
      if (homeScore !== undefined && awayScore !== undefined) {
        await this.matches.setPeriodScore(row.leaguecore_entity_id, { period: 'full_time', homeScore, awayScore }, meta, userId);
      }
      return;
    }
    throw new BadRequestException(`No se puede reemplazar automáticamente un conflicto de tipo "${row.entity_type}"`);
  }
}
