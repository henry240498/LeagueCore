import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import {
  ImportAdvancedMetricsDto,
  ImportPlayerPhysicalDto,
  ImportPlayerPositionsDto,
} from './dto/import-match-data.dto';

/**
 * Importación masiva de datos avanzados de un partido.
 *
 * `match_advanced_metrics`, `match_player_positions` y `match_player_physical_stats` existían en el
 * esquema pero NADA podía escribirlas, así que el xG, los mapas de calor y los datos físicos nunca
 * podían tener información. Su volumen (cientos o miles de filas por partido) descarta la carga a
 * mano: se cargan por lote desde la planilla del proveedor.
 *
 * Criterios comunes:
 *  - El jugador debe figurar en la alineación del partido; de ahí se deriva su equipo. Si aparece
 *    alguno que no jugó, se rechaza TODO el lote indicando cuáles, en vez de importar a medias.
 *  - Métricas y posiciones se REEMPLAZAN por partido: volver a importar corrige, no duplica
 *    (esas tablas no tienen clave única que lo impida).
 *  - Los datos físicos hacen upsert por (partido, jugador), que sí es su clave primaria.
 */

// Tamaño de lote para los INSERT multi-fila: evita armar una sentencia gigantesca y mantiene
// todos los valores parametrizados.
const CHUNK = 200;

@Injectable()
export class MatchImportService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  /** Mapa jugador -> equipo según la alineación REAL del partido. */
  private async lineupTeams(matchId: number): Promise<Map<number, number>> {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query('SELECT player_id, team_id FROM dbo.match_lineups WHERE match_id = @match_id');
    return new Map(result.recordset.map((r) => [r.player_id as number, r.team_id as number]));
  }

  private async assertMatchExists(matchId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, matchId)
      .query('SELECT TOP 1 1 FROM dbo.matches WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('El partido indicado no existe');
  }

  /** Rechaza el lote completo si algún jugador no está en la alineación. */
  private assertPlayersInLineup(playerIds: number[], teams: Map<number, number>) {
    const missing = [...new Set(playerIds)].filter((id) => !teams.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Estos jugadores no figuran en la alineación del partido: ${missing.join(', ')}. ` +
          'Cargá primero la alineación para poder asignar su equipo.',
      );
    }
  }

  /** Inserta filas en lotes, con todos los valores parametrizados. */
  private async insertInChunks(
    table: string,
    columns: string[],
    rows: (sql.ISqlType | any)[][],
    types: (sql.ISqlType | (() => sql.ISqlType))[],
  ) {
    for (let start = 0; start < rows.length; start += CHUNK) {
      const slice = rows.slice(start, start + CHUNK);
      const request = this.pool.request();
      const tuples: string[] = [];
      slice.forEach((values, i) => {
        const params = values.map((value, c) => {
          const name = `p${i}_${c}`;
          request.input(name, types[c], value);
          return `@${name}`;
        });
        tuples.push(`(${params.join(', ')})`);
      });
      await request.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`);
    }
  }

  // ------------------------------------------------------------------ Métricas avanzadas (xG, xA…)
  async importAdvancedMetrics(matchId: number, dto: ImportAdvancedMetricsDto) {
    await this.assertMatchExists(matchId);
    const teams = await this.lineupTeams(matchId);

    // Cada fila debe apuntar a un jugador o a un equipo (lo exige el CHECK de la tabla).
    const withoutTarget = dto.rows.findIndex((r) => r.playerId == null && r.teamId == null);
    if (withoutTarget >= 0) {
      throw new BadRequestException(
        `La fila ${withoutTarget + 1} no indica jugador ni equipo: toda métrica debe pertenecer a uno de los dos.`,
      );
    }

    const playerRows = dto.rows.filter((r) => r.playerId != null);
    this.assertPlayersInLineup(playerRows.map((r) => r.playerId as number), teams);

    // Se reemplazan las métricas del partido: reimportar corrige en vez de duplicar.
    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query('DELETE FROM dbo.match_advanced_metrics WHERE match_id = @match_id');

    const rows = dto.rows.map((r) => [
      matchId,
      // Si viene por jugador, el equipo sale de la alineación (no del cliente).
      r.playerId != null ? teams.get(r.playerId)! : (r.teamId ?? null),
      r.playerId ?? null,
      r.metricName,
      r.metricValue,
      r.provider ?? null,
      r.modelVersion ?? null,
    ]);

    await this.insertInChunks(
      'dbo.match_advanced_metrics',
      ['match_id', 'team_id', 'player_id', 'metric_name', 'metric_value', 'provider', 'model_version'],
      rows,
      [sql.Int, sql.Int, sql.Int, sql.NVarChar(50), sql.Decimal(10, 4), sql.NVarChar(50), sql.NVarChar(50)],
    );

    return { imported: rows.length, replaced: true };
  }

  // ----------------------------------------------------- Posiciones (mapa de calor / posición media)
  async importPlayerPositions(matchId: number, dto: ImportPlayerPositionsDto) {
    await this.assertMatchExists(matchId);
    const teams = await this.lineupTeams(matchId);
    this.assertPlayersInLineup(dto.rows.map((r) => r.playerId), teams);

    await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query('DELETE FROM dbo.match_player_positions WHERE match_id = @match_id');

    const rows = dto.rows.map((r) => [
      matchId,
      r.playerId,
      teams.get(r.playerId)!,
      r.period ?? null,
      r.minute ?? null,
      r.posX,
      r.posY,
      r.weight ?? null,
      r.source ?? null,
    ]);

    await this.insertInChunks(
      'dbo.match_player_positions',
      ['match_id', 'player_id', 'team_id', 'period', 'minute', 'pos_x', 'pos_y', 'weight', 'source'],
      rows,
      [
        sql.Int,
        sql.Int,
        sql.Int,
        sql.NVarChar(20),
        sql.SmallInt,
        sql.Decimal(5, 2),
        sql.Decimal(5, 2),
        sql.Decimal(6, 2),
        sql.NVarChar(50),
      ],
    );

    return { imported: rows.length, replaced: true };
  }

  // ------------------------------------------------------------------------- Datos físicos (GPS)
  async importPlayerPhysical(matchId: number, dto: ImportPlayerPhysicalDto) {
    await this.assertMatchExists(matchId);
    const teams = await this.lineupTeams(matchId);
    this.assertPlayersInLineup(dto.rows.map((r) => r.playerId), teams);

    // (match_id, player_id) es clave primaria -> upsert fila por fila, sin borrar nada previo.
    for (const r of dto.rows) {
      await this.pool
        .request()
        .input('match_id', sql.Int, matchId)
        .input('player_id', sql.Int, r.playerId)
        .input('distance_km', sql.Decimal(5, 2), r.distanceKm ?? null)
        .input('top_speed_kmh', sql.Decimal(4, 1), r.topSpeedKmh ?? null)
        .input('steps_count', sql.Int, r.stepsCount ?? null)
        .input('sprints_count', sql.SmallInt, r.sprintsCount ?? null)
        .input('accelerations', sql.SmallInt, r.accelerations ?? null)
        .input('decelerations', sql.SmallInt, r.decelerations ?? null)
        .input('walk_distance_km', sql.Decimal(5, 2), r.walkDistanceKm ?? null)
        .input('jog_distance_km', sql.Decimal(5, 2), r.jogDistanceKm ?? null)
        .input('run_distance_km', sql.Decimal(5, 2), r.runDistanceKm ?? null)
        .input('sprint_distance_km', sql.Decimal(5, 2), r.sprintDistanceKm ?? null)
        .input('data_source', sql.NVarChar(50), r.dataSource ?? null)
        .query(
          `MERGE dbo.match_player_physical_stats AS target
           USING (SELECT @match_id AS match_id, @player_id AS player_id) AS src
           ON target.match_id = src.match_id AND target.player_id = src.player_id
           WHEN MATCHED THEN UPDATE SET
             distance_km = @distance_km, top_speed_kmh = @top_speed_kmh, steps_count = @steps_count,
             sprints_count = @sprints_count, accelerations = @accelerations, decelerations = @decelerations,
             walk_distance_km = @walk_distance_km, jog_distance_km = @jog_distance_km,
             run_distance_km = @run_distance_km, sprint_distance_km = @sprint_distance_km,
             data_source = @data_source, updated_at = SYSUTCDATETIME()
           WHEN NOT MATCHED THEN INSERT
             (match_id, player_id, distance_km, top_speed_kmh, steps_count, sprints_count, accelerations,
              decelerations, walk_distance_km, jog_distance_km, run_distance_km, sprint_distance_km, data_source)
           VALUES
             (@match_id, @player_id, @distance_km, @top_speed_kmh, @steps_count, @sprints_count, @accelerations,
              @decelerations, @walk_distance_km, @jog_distance_km, @run_distance_km, @sprint_distance_km, @data_source);`,
        );
    }

    return { imported: dto.rows.length, replaced: false };
  }
}
