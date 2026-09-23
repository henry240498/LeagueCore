import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { SetPlayerStatsDto } from './dto/set-player-stats.dto';
import { SetTeamStatsDto } from './dto/set-team-stats.dto';

// ---------------------------------------------------------------- Estadísticas por JUGADOR
// Mismo patrón que las de equipo (MERGE + mapa de columnas): dbo.match_player_stats existía en el
// esquema pero no tenía forma de escribirse, así que las métricas individuales nunca podían
// cargarse. Sólo se mapean las columnas que la tabla tiene realmente.
const PLAYER_COLUMN_MAP: Record<string, string> = {
  shots: 'shots',
  shotsOnTarget: 'shots_on_target',
  passes: 'passes',
  passesCompleted: 'passes_completed',
  touches: 'touches',
  tackles: 'tackles',
  tacklesWon: 'tackles_won',
  interceptions: 'interceptions',
  clearances: 'clearances',
  recoveries: 'recoveries',
  duelsGroundWon: 'duels_ground_won',
  duelsGroundLost: 'duels_ground_lost',
  duelsAerialWon: 'duels_aerial_won',
  duelsAerialLost: 'duels_aerial_lost',
  blocksShots: 'blocks_shots',
  blocksPasses: 'blocks_passes',
};

function playerToCamel(row: Record<string, any>) {
  const out: Record<string, any> = {
    playerId: row.player_id,
    teamId: row.team_id,
    playerFullName: row.full_name ?? null,
    shirtNumber: row.shirt_number ?? null,
    dataSource: row.data_source,
    updatedAt: row.updated_at,
  };
  for (const [camel, snake] of Object.entries(PLAYER_COLUMN_MAP)) out[camel] = row[snake];
  return out;
}

const COLUMN_MAP: Record<string, string> = {
  possessionPct: 'possession_pct',
  shots: 'shots',
  shotsOnTarget: 'shots_on_target',
  shotsOffTarget: 'shots_off_target',
  shotsBlocked: 'shots_blocked',
  corners: 'corners',
  fouls: 'fouls',
  offsidesCount: 'offsides_count',
  throwIns: 'throw_ins',
  goalKicks: 'goal_kicks',
  freeKicksDirect: 'free_kicks_direct',
  freeKicksIndirect: 'free_kicks_indirect',
  passes: 'passes',
  passesCompleted: 'passes_completed',
  touches: 'touches',
};

const COLUMN_TYPES: Record<string, (() => sql.ISqlType) | sql.ISqlType> = {
  possession_pct: sql.Decimal(4, 1),
  shots: sql.SmallInt,
  shots_on_target: sql.SmallInt,
  shots_off_target: sql.SmallInt,
  shots_blocked: sql.SmallInt,
  corners: sql.SmallInt,
  fouls: sql.SmallInt,
  offsides_count: sql.SmallInt,
  throw_ins: sql.SmallInt,
  goal_kicks: sql.SmallInt,
  free_kicks_direct: sql.SmallInt,
  free_kicks_indirect: sql.SmallInt,
  passes: sql.SmallInt,
  passes_completed: sql.SmallInt,
  touches: sql.SmallInt,
};

function toCamel(row: Record<string, any>) {
  const out: Record<string, any> = { teamId: row.team_id, updatedAt: row.updated_at, dataSource: row.data_source };
  for (const [camel, snake] of Object.entries(COLUMN_MAP)) out[camel] = row[snake];
  return out;
}

@Injectable()
export class MatchStatsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async list(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query('SELECT * FROM dbo.match_team_stats WHERE match_id = @match_id');
    return result.recordset.map(toCamel);
  }

  async setForTeam(matchId: number, teamId: number, dto: SetTeamStatsDto) {
    const team = await this.pool.request().input('id', sql.Int, teamId).query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (team.recordset.length === 0) throw new BadRequestException('El equipo indicado no existe');

    const setClauses: string[] = [];
    const insertColumns = ['match_id', 'team_id'];
    const insertParams = ['@match_id', '@team_id'];
    const request = this.pool.request().input('match_id', sql.Int, matchId).input('team_id', sql.Int, teamId);

    for (const [camel, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const column = COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, COLUMN_TYPES[column], value);
      setClauses.push(`${column} = @${column}`);
      insertColumns.push(column);
      insertParams.push(`@${column}`);
    }
    setClauses.push('updated_at = SYSUTCDATETIME()');

    await request.query(
      `MERGE dbo.match_team_stats AS target
       USING (SELECT @match_id AS match_id, @team_id AS team_id) AS src
       ON target.match_id = src.match_id AND target.team_id = src.team_id
       WHEN MATCHED THEN UPDATE SET ${setClauses.join(', ')}
       WHEN NOT MATCHED THEN INSERT (${insertColumns.join(', ')}) VALUES (${insertParams.join(', ')});`,
    );

    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, teamId)
      .query('SELECT * FROM dbo.match_team_stats WHERE match_id = @match_id AND team_id = @team_id');
    return toCamel(result.recordset[0]);
  }

  // ------------------------------------------------------- Estadísticas individuales (por jugador)

  /** Estadísticas individuales cargadas en este partido, con nombre y dorsal para mostrarlas. */
  async listPlayerStats(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT s.*, p.full_name, l.shirt_number
         FROM dbo.match_player_stats s
         JOIN dbo.players p ON p.id = s.player_id
         LEFT JOIN dbo.match_lineups l ON l.match_id = s.match_id AND l.player_id = s.player_id
         WHERE s.match_id = @match_id
         ORDER BY s.team_id, l.shirt_number`,
      );
    return result.recordset.map(playerToCamel);
  }

  /**
   * Upsert de las estadísticas de un jugador en un partido.
   *
   * El equipo NO se recibe del cliente: se deriva de la alineación real del partido, que es la
   * única fuente correcta (un jugador pertenece al equipo con el que figura en ESE partido). Si el
   * jugador no está en la alineación se rechaza, en vez de adivinar un equipo.
   */
  async setForPlayer(matchId: number, playerId: number, dto: SetPlayerStatsDto) {
    const lineup = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT TOP 1 team_id FROM dbo.match_lineups
         WHERE match_id = @match_id AND player_id = @player_id`,
      );
    const teamId = lineup.recordset[0]?.team_id;
    if (teamId == null) {
      throw new BadRequestException(
        'El jugador no figura en la alineación de este partido: cargalo primero en "Jugadores (alineación)".',
      );
    }

    const setClauses: string[] = [];
    const insertColumns = ['match_id', 'player_id', 'team_id'];
    const insertParams = ['@match_id', '@player_id', '@team_id'];
    const request = this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, playerId)
      .input('team_id', sql.Int, teamId);

    for (const [camel, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      const column = PLAYER_COLUMN_MAP[camel];
      if (!column) continue;
      request.input(column, sql.SmallInt, value);
      setClauses.push(`${column} = @${column}`);
      insertColumns.push(column);
      insertParams.push(`@${column}`);
    }
    // Se actualiza siempre el equipo por si el jugador cambió de lado respecto a una carga previa.
    setClauses.push('team_id = @team_id', 'updated_at = SYSUTCDATETIME()');

    await request.query(
      `MERGE dbo.match_player_stats AS target
       USING (SELECT @match_id AS match_id, @player_id AS player_id) AS src
       ON target.match_id = src.match_id AND target.player_id = src.player_id
       WHEN MATCHED THEN UPDATE SET ${setClauses.join(', ')}
       WHEN NOT MATCHED THEN INSERT (${insertColumns.join(', ')}) VALUES (${insertParams.join(', ')});`,
    );

    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT s.*, p.full_name, l.shirt_number
         FROM dbo.match_player_stats s
         JOIN dbo.players p ON p.id = s.player_id
         LEFT JOIN dbo.match_lineups l ON l.match_id = s.match_id AND l.player_id = s.player_id
         WHERE s.match_id = @match_id AND s.player_id = @player_id`,
      );
    return playerToCamel(result.recordset[0]);
  }
}
