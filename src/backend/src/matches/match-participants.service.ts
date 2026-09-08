import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { AddLineupEntryDto } from './dto/add-lineup-entry.dto';
import { AddMatchCoachDto } from './dto/add-match-coach.dto';
import { AddMatchOfficialDto } from './dto/add-match-official.dto';
import { SetMatchFormationDto } from './dto/set-match-formation.dto';

@Injectable()
export class MatchParticipantsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // ---------- Oficiales del partido (Partido ↔ Oficial CON ROL) ----------
  async listOfficials(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT mo.id, mo.role, o.id AS official_id, o.full_name, ot.name AS official_type_name
         FROM dbo.match_officials mo
         JOIN dbo.officials o ON o.id = mo.official_id
         LEFT JOIN dbo.official_types ot ON ot.id = o.official_type_id
         WHERE mo.match_id = @match_id`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      role: r.role,
      officialId: r.official_id,
      officialFullName: r.full_name,
      officialTypeName: r.official_type_name,
    }));
  }

  async addOfficial(matchId: number, dto: AddMatchOfficialDto) {
    const official = await this.pool
      .request()
      .input('id', sql.Int, dto.officialId)
      .query('SELECT TOP 1 1 FROM dbo.officials WHERE id = @id');
    if (official.recordset.length === 0) throw new BadRequestException('El oficial indicado no existe');

    try {
      const result = await this.pool
        .request()
        .input('match_id', sql.Int, matchId)
        .input('official_id', sql.Int, dto.officialId)
        .input('role', sql.NVarChar, dto.role)
        .query(
          `INSERT INTO dbo.match_officials (match_id, official_id, role)
           OUTPUT INSERTED.id
           VALUES (@match_id, @official_id, @role)`,
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ya hay un oficial asignado a ese rol en este partido');
      }
      throw err;
    }
  }

  async removeOfficial(matchId: number, matchOfficialId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, matchOfficialId)
      .input('match_id', sql.Int, matchId)
      .query('DELETE FROM dbo.match_officials WHERE id = @id AND match_id = @match_id');
    if (result.rowsAffected[0] === 0) throw new NotFoundException('Asignación de oficial no encontrada');
  }

  // ---------- Cuerpo técnico del partido ----------
  async listCoaches(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT mc.id, mc.role, mc.team_id, t.name AS team_name, c.id AS coach_id, c.full_name
         FROM dbo.match_coaches mc
         JOIN dbo.teams t ON t.id = mc.team_id
         JOIN dbo.coaches c ON c.id = mc.coach_id
         WHERE mc.match_id = @match_id`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      role: r.role,
      teamId: r.team_id,
      teamName: r.team_name,
      coachId: r.coach_id,
      coachFullName: r.full_name,
    }));
  }

  async addCoach(matchId: number, dto: AddMatchCoachDto) {
    const coach = await this.pool
      .request()
      .input('id', sql.Int, dto.coachId)
      .query('SELECT TOP 1 1 FROM dbo.coaches WHERE id = @id');
    if (coach.recordset.length === 0) throw new BadRequestException('El entrenador indicado no existe');

    try {
      const result = await this.pool
        .request()
        .input('match_id', sql.Int, matchId)
        .input('team_id', sql.Int, dto.teamId)
        .input('coach_id', sql.Int, dto.coachId)
        .input('role', sql.NVarChar, dto.role ?? 'head_coach')
        .query(
          `INSERT INTO dbo.match_coaches (match_id, team_id, coach_id, role)
           OUTPUT INSERTED.id
           VALUES (@match_id, @team_id, @coach_id, @role)`,
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ese entrenador ya está registrado en este partido para ese equipo');
      }
      throw err;
    }
  }

  async removeCoach(matchId: number, matchCoachId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, matchCoachId)
      .input('match_id', sql.Int, matchId)
      .query('DELETE FROM dbo.match_coaches WHERE id = @id AND match_id = @match_id');
    if (result.rowsAffected[0] === 0) throw new NotFoundException('Asignación de entrenador no encontrada');
  }

  // ---------- Alineaciones (jugadores participantes) ----------
  async listLineups(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT l.id, l.team_id, l.player_id, p.full_name, p.photo_url, p.nationality, l.is_starting, l.shirt_number,
                COALESCE(l.position, p.position) AS position, l.minutes_played, l.pos_x, l.pos_y,
                (SELECT COUNT(*) FROM dbo.goals g WHERE g.match_id = l.match_id AND g.player_id = l.player_id AND g.own_goal = 0) AS goals,
                (SELECT COUNT(*) FROM dbo.goals g WHERE g.match_id = l.match_id AND g.assist_player_id = l.player_id) AS assists,
                (SELECT COUNT(*) FROM dbo.cards c WHERE c.match_id = l.match_id AND c.player_id = l.player_id AND c.card_type = 'yellow') AS yellow_cards,
                (SELECT COUNT(*) FROM dbo.cards c WHERE c.match_id = l.match_id AND c.player_id = l.player_id AND c.card_type IN ('red','second_yellow')) AS red_cards
         FROM dbo.match_lineups l
         JOIN dbo.players p ON p.id = l.player_id
         WHERE l.match_id = @match_id
         ORDER BY l.team_id, l.is_starting DESC, l.shirt_number`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      playerId: r.player_id,
      playerFullName: r.full_name,
      photoUrl: r.photo_url,
      nationality: r.nationality,
      isStarting: !!r.is_starting,
      shirtNumber: r.shirt_number,
      position: r.position,
      minutesPlayed: r.minutes_played,
      posX: r.pos_x,
      posY: r.pos_y,
      // goles/asistencias/tarjetas son SIEMPRE derivados de goals/cards, nunca guardados
      // aparte, para que no puedan desincronizarse del timeline real.
      goals: r.goals,
      assists: r.assists,
      yellowCards: r.yellow_cards,
      redCards: r.red_cards,
    }));
  }

  async setLineupPosition(matchId: number, lineupId: number, posX: number, posY: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, lineupId)
      .input('match_id', sql.Int, matchId)
      .input('pos_x', sql.Decimal(5, 2), posX)
      .input('pos_y', sql.Decimal(5, 2), posY)
      .query('UPDATE dbo.match_lineups SET pos_x = @pos_x, pos_y = @pos_y WHERE id = @id AND match_id = @match_id');
    if (result.rowsAffected[0] === 0) throw new NotFoundException('Participante no encontrado');
  }

  async addLineupEntry(matchId: number, dto: AddLineupEntryDto) {
    const player = await this.pool
      .request()
      .input('id', sql.Int, dto.playerId)
      .query('SELECT TOP 1 1 FROM dbo.players WHERE id = @id');
    if (player.recordset.length === 0) throw new BadRequestException('El jugador indicado no existe');

    try {
      const result = await this.pool
        .request()
        .input('match_id', sql.Int, matchId)
        .input('team_id', sql.Int, dto.teamId)
        .input('player_id', sql.Int, dto.playerId)
        .input('is_starting', sql.Bit, dto.isStarting ?? false)
        .input('shirt_number', sql.SmallInt, dto.shirtNumber ?? null)
        .input('position', sql.NVarChar, dto.position ?? null)
        .input('minutes_played', sql.SmallInt, dto.minutesPlayed ?? null)
        .query(
          `INSERT INTO dbo.match_lineups (match_id, team_id, player_id, is_starting, shirt_number, position, minutes_played)
           OUTPUT INSERTED.id
           VALUES (@match_id, @team_id, @player_id, @is_starting, @shirt_number, @position, @minutes_played)`,
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ese jugador ya está registrado como participante de este partido');
      }
      throw err;
    }
  }

  async removeLineupEntry(matchId: number, lineupId: number) {
    const lineup = await this.pool
      .request()
      .input('id', sql.Int, lineupId)
      .input('match_id', sql.Int, matchId)
      .query('SELECT player_id FROM dbo.match_lineups WHERE id = @id AND match_id = @match_id');
    if (lineup.recordset.length === 0) throw new NotFoundException('Participante no encontrado');
    const playerId = lineup.recordset[0].player_id;

    // goals/cards/substitutions/offsides/penalty_kicks referencian al JUGADOR, no a esta fila
    // de alineación (no hay FK que proteja esto automáticamente) — se valida a mano que no
    // tenga eventos ya cargados en este partido antes de permitir quitarlo.
    const hasEvents = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT
           (SELECT COUNT(*) FROM dbo.goals WHERE match_id = @match_id AND (player_id = @player_id OR assist_player_id = @player_id)) +
           (SELECT COUNT(*) FROM dbo.cards WHERE match_id = @match_id AND player_id = @player_id) +
           (SELECT COUNT(*) FROM dbo.substitutions WHERE match_id = @match_id AND (player_out_id = @player_id OR player_in_id = @player_id)) +
           (SELECT COUNT(*) FROM dbo.offsides WHERE match_id = @match_id AND player_id = @player_id) +
           (SELECT COUNT(*) FROM dbo.penalty_kicks WHERE match_id = @match_id AND player_id = @player_id) AS total`,
      );
    if (hasEvents.recordset[0].total > 0) {
      throw new BadRequestException(
        'No se puede quitar: el jugador ya tiene goles, tarjetas u otros eventos registrados en este partido.',
      );
    }

    await this.pool
      .request()
      .input('id', sql.Int, lineupId)
      .query('DELETE FROM dbo.match_lineups WHERE id = @id');
  }

  // ---------- Formación táctica (equipo, no jugador individual) ----------
  // Distinto de match_lineups.pos_x/pos_y (posición real de CADA jugador, ya existía) -- esto es
  // la forma del EQUIPO ("Olimpia — 4-3-3"), que la vista táctica usa para armar una grilla de
  // posiciones realista en vez de repartir jugadores parejo dentro de su categoría de posición.
  // `period` NULL = formación de todo el partido; un valor real (ej. 'second_half') registra un
  // cambio táctico sin perder la formación anterior, nunca se sobrescribe.
  async listFormations(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT id, team_id, formation_shape, period, source, updated_at
         FROM dbo.match_formations WHERE match_id = @match_id ORDER BY team_id, period`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      formationShape: r.formation_shape,
      period: r.period,
      source: r.source,
      updatedAt: r.updated_at,
    }));
  }

  async setFormation(matchId: number, dto: SetMatchFormationDto) {
    const period = dto.period ?? null;
    const existing = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('period', sql.NVarChar, period)
      .query(
        `SELECT id FROM dbo.match_formations
         WHERE match_id = @match_id AND team_id = @team_id AND (period = @period OR (period IS NULL AND @period IS NULL))`,
      );

    if (existing.recordset.length > 0) {
      await this.pool
        .request()
        .input('id', sql.Int, existing.recordset[0].id)
        .input('formation_shape', sql.NVarChar, dto.formationShape)
        .input('source', sql.NVarChar, dto.source ?? null)
        .query(
          `UPDATE dbo.match_formations SET formation_shape = @formation_shape, source = @source, updated_at = SYSUTCDATETIME()
           WHERE id = @id`,
        );
      return { id: existing.recordset[0].id };
    }

    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('formation_shape', sql.NVarChar, dto.formationShape)
      .input('period', sql.NVarChar, period)
      .input('source', sql.NVarChar, dto.source ?? null)
      .query(
        `INSERT INTO dbo.match_formations (match_id, team_id, formation_shape, period, source)
         OUTPUT INSERTED.id
         VALUES (@match_id, @team_id, @formation_shape, @period, @source)`,
      );
    return { id: result.recordset[0].id };
  }

  // ---------- Analítica avanzada (esquema listo desde 2026-08-24, sin datos reales todavía) --
  // estos tres métodos son de sólo lectura y devuelven un array vacío cuando no hay nada cargado
  // (siempre, hoy) -- la interfaz real consulta esto en vez de asumir "no hay datos" sin preguntar.
  async listPlayerPositions(matchId: number, playerId?: number) {
    const request = this.pool.request().input('match_id', sql.Int, matchId);
    let where = 'match_id = @match_id';
    if (playerId) {
      request.input('player_id', sql.Int, playerId);
      where += ' AND player_id = @player_id';
    }
    const result = await request.query(
      `SELECT id, player_id, team_id, period, minute, pos_x, pos_y, weight, source, recorded_at
       FROM dbo.match_player_positions WHERE ${where} ORDER BY minute`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      playerId: r.player_id,
      teamId: r.team_id,
      period: r.period,
      minute: r.minute,
      posX: r.pos_x,
      posY: r.pos_y,
      weight: r.weight,
      source: r.source,
      recordedAt: r.recorded_at,
    }));
  }

  async listAdvancedMetrics(matchId: number, playerId?: number) {
    const request = this.pool.request().input('match_id', sql.Int, matchId);
    let where = 'match_id = @match_id';
    if (playerId) {
      request.input('player_id', sql.Int, playerId);
      where += ' AND player_id = @player_id';
    }
    const result = await request.query(
      `SELECT id, team_id, player_id, metric_name, metric_value, provider, model_version, recorded_at
       FROM dbo.match_advanced_metrics WHERE ${where} ORDER BY metric_name`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      playerId: r.player_id,
      metricName: r.metric_name,
      metricValue: r.metric_value,
      provider: r.provider,
      modelVersion: r.model_version,
      recordedAt: r.recorded_at,
    }));
  }

  async getPhysicalStats(matchId: number, playerId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT match_id, player_id, distance_km, top_speed_kmh, steps_count, sprints_count,
                accelerations, decelerations, walk_distance_km, jog_distance_km, run_distance_km,
                sprint_distance_km, data_source, updated_at
         FROM dbo.match_player_physical_stats WHERE match_id = @match_id AND player_id = @player_id`,
      );
    const r = result.recordset[0];
    if (!r) return null;
    return {
      distanceKm: r.distance_km,
      topSpeedKmh: r.top_speed_kmh,
      stepsCount: r.steps_count,
      sprintsCount: r.sprints_count,
      accelerations: r.accelerations,
      decelerations: r.decelerations,
      walkDistanceKm: r.walk_distance_km,
      jogDistanceKm: r.jog_distance_km,
      runDistanceKm: r.run_distance_km,
      sprintDistanceKm: r.sprint_distance_km,
      dataSource: r.data_source,
      updatedAt: r.updated_at,
    };
  }
}
