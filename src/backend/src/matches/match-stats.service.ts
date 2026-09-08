import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { SetTeamStatsDto } from './dto/set-team-stats.dto';

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
}
