import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { AddCardDto } from './dto/add-card.dto';
import { AddFoulDto } from './dto/add-foul.dto';
import { AddGoalDto } from './dto/add-goal.dto';
import { AddInterruptionDto } from './dto/add-interruption.dto';
import { AddOffsideDto } from './dto/add-offside.dto';
import { AddPenaltyKickDto } from './dto/add-penalty-kick.dto';
import { AddShootoutKickDto } from './dto/add-shootout-kick.dto';
import { AddShotDto } from './dto/add-shot.dto';
import { AddSubstitutionDto } from './dto/add-substitution.dto';

// Cada tipo de evento vive en su propia tabla normalizada (goals/cards/substitutions ya
// existían desde la migración 001; offsides/match_interruptions/match_shootout_kicks son
// nuevas) — el timeline unificado que arma getTimeline() es sólo una vista de LECTURA que
// combina todas, no una tabla "eventos" genérica con columnas opcionales para cada tipo
// (eso sí hubiera sido la "tabla gigante" que se pidió evitar).
@Injectable()
export class MatchEventsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  private async assertLineupMembership(matchId: number, teamId: number, playerId: number | null | undefined) {
    if (!playerId) return;
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, teamId)
      .input('player_id', sql.Int, playerId)
      .query(
        `SELECT TOP 1 1 FROM dbo.match_lineups
         WHERE match_id = @match_id AND team_id = @team_id AND player_id = @player_id`,
      );
    if (result.recordset.length === 0) {
      throw new BadRequestException(
        'El jugador indicado no está registrado como participante de ese equipo en este partido (cargalo primero en Jugadores del partido)',
      );
    }
  }

  // ---------- Goles ----------
  async addGoal(matchId: number, dto: AddGoalDto) {
    await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    if (dto.assistPlayerId) await this.assertLineupMembership(matchId, dto.teamId, dto.assistPlayerId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, dto.playerId)
      .input('team_id', sql.Int, dto.teamId)
      .input('assist_player_id', sql.Int, dto.assistPlayerId ?? null)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .input('own_goal', sql.Bit, dto.ownGoal ?? false)
      .input('penalty', sql.Bit, dto.penalty ?? false)
      .input('goal_type', sql.NVarChar, dto.goalType ?? null)
      .input('pos_x', sql.Decimal(5, 2), dto.posX ?? null)
      .input('pos_y', sql.Decimal(5, 2), dto.posY ?? null)
      .query(
        `INSERT INTO dbo.goals
           (match_id, player_id, team_id, assist_player_id, minute, minute_extra, period, own_goal, penalty, goal_type, pos_x, pos_y)
         OUTPUT INSERTED.id
         VALUES
           (@match_id, @player_id, @team_id, @assist_player_id, @minute, @minute_extra, @period, @own_goal, @penalty, @goal_type, @pos_x, @pos_y)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeGoal(matchId: number, goalId: number) {
    await this.deleteOrThrow('dbo.goals', matchId, goalId, 'Gol no encontrado');
  }

  // ---------- Tarjetas ----------
  async addCard(matchId: number, dto: AddCardDto) {
    await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, dto.playerId)
      .input('team_id', sql.Int, dto.teamId)
      .input('card_type', sql.NVarChar, dto.cardType)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .input('reason', sql.NVarChar, dto.reason ?? null)
      .query(
        `INSERT INTO dbo.cards (match_id, player_id, team_id, card_type, minute, minute_extra, period, reason)
         OUTPUT INSERTED.id
         VALUES (@match_id, @player_id, @team_id, @card_type, @minute, @minute_extra, @period, @reason)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeCard(matchId: number, cardId: number) {
    await this.deleteOrThrow('dbo.cards', matchId, cardId, 'Tarjeta no encontrada');
  }

  // ---------- Sustituciones ----------
  async addSubstitution(matchId: number, dto: AddSubstitutionDto) {
    await this.assertLineupMembership(matchId, dto.teamId, dto.playerOutId);
    await this.assertLineupMembership(matchId, dto.teamId, dto.playerInId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_out_id', sql.Int, dto.playerOutId)
      .input('player_in_id', sql.Int, dto.playerInId)
      .input('team_id', sql.Int, dto.teamId)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .input('reason', sql.NVarChar, dto.reason ?? null)
      .query(
        `INSERT INTO dbo.substitutions
           (match_id, player_out_id, player_in_id, team_id, minute, minute_extra, period, reason)
         OUTPUT INSERTED.id
         VALUES (@match_id, @player_out_id, @player_in_id, @team_id, @minute, @minute_extra, @period, @reason)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeSubstitution(matchId: number, subId: number) {
    await this.deleteOrThrow('dbo.substitutions', matchId, subId, 'Sustitución no encontrada');
  }

  // ---------- Faltas ----------
  async addFoul(matchId: number, dto: AddFoulDto) {
    if (dto.playerId) await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('player_id', sql.Int, dto.playerId ?? null)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .input('card_id', sql.Int, dto.cardId ?? null)
      .input('note', sql.NVarChar, dto.note ?? null)
      .query(
        `INSERT INTO dbo.fouls (match_id, team_id, player_id, minute, minute_extra, period, card_id, note)
         OUTPUT INSERTED.id
         VALUES (@match_id, @team_id, @player_id, @minute, @minute_extra, @period, @card_id, @note)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeFoul(matchId: number, foulId: number) {
    await this.deleteOrThrow('dbo.fouls', matchId, foulId, 'Falta no encontrada');
  }

  // ---------- Offsides ----------
  async addOffside(matchId: number, dto: AddOffsideDto) {
    if (dto.playerId) await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('team_id', sql.Int, dto.teamId)
      .input('player_id', sql.Int, dto.playerId ?? null)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .query(
        `INSERT INTO dbo.offsides (match_id, team_id, player_id, minute, minute_extra, period)
         OUTPUT INSERTED.id
         VALUES (@match_id, @team_id, @player_id, @minute, @minute_extra, @period)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeOffside(matchId: number, offsideId: number) {
    await this.deleteOrThrow('dbo.offsides', matchId, offsideId, 'Fuera de juego no encontrado');
  }

  // ---------- Tiros (que NO terminaron en gol -- un tiro convertido ya es una fila en
  // dbo.goals; mismo criterio que penalty_kicks respecto de goals) ----------
  async addShot(matchId: number, dto: AddShotDto) {
    await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, dto.playerId)
      .input('team_id', sql.Int, dto.teamId)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .input('pos_x', sql.Decimal(5, 2), dto.posX)
      .input('pos_y', sql.Decimal(5, 2), dto.posY)
      .input('outcome', sql.NVarChar, dto.outcome)
      .input('body_part', sql.NVarChar, dto.bodyPart ?? null)
      .input('xg', sql.Decimal(4, 3), dto.xg ?? null)
      .query(
        `INSERT INTO dbo.shots
           (match_id, player_id, team_id, minute, minute_extra, period, pos_x, pos_y, outcome, body_part, xg)
         OUTPUT INSERTED.id
         VALUES
           (@match_id, @player_id, @team_id, @minute, @minute_extra, @period, @pos_x, @pos_y, @outcome, @body_part, @xg)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeShot(matchId: number, shotId: number) {
    await this.deleteOrThrow('dbo.shots', matchId, shotId, 'Tiro no encontrado');
  }

  // Mapa de tiros: goles (dbo.goals, outcome='goal') + tiros que no fueron gol (dbo.shots),
  // combinados en una sola lista para dibujar sobre la cancha -- sin duplicar ningún dato.
  async getShotMap(matchId: number) {
    const [goals, shots] = await Promise.all([
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT g.id, g.minute, g.minute_extra, g.period, g.team_id, t.name AS team_name,
                g.player_id, p.full_name AS player_name, g.pos_x, g.pos_y, g.penalty, g.own_goal
         FROM dbo.goals g
         JOIN dbo.teams t ON t.id = g.team_id
         JOIN dbo.players p ON p.id = g.player_id
         WHERE g.match_id = @match_id AND g.pos_x IS NOT NULL AND g.pos_y IS NOT NULL`,
      ),
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT s.id, s.minute, s.minute_extra, s.period, s.team_id, t.name AS team_name,
                s.player_id, p.full_name AS player_name, s.pos_x, s.pos_y, s.outcome, s.body_part, s.xg
         FROM dbo.shots s
         JOIN dbo.teams t ON t.id = s.team_id
         JOIN dbo.players p ON p.id = s.player_id
         WHERE s.match_id = @match_id`,
      ),
    ]);

    const result = [
      ...goals.recordset.map((r) => ({
        id: r.id,
        source: 'goal' as const,
        outcome: 'goal',
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerId: r.player_id,
        playerName: r.player_name,
        posX: r.pos_x,
        posY: r.pos_y,
        penalty: !!r.penalty,
        ownGoal: !!r.own_goal,
        xg: null as number | null,
      })),
      ...shots.recordset.map((r) => ({
        id: r.id,
        source: 'shot' as const,
        outcome: r.outcome,
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerId: r.player_id,
        playerName: r.player_name,
        posX: r.pos_x,
        posY: r.pos_y,
        penalty: false,
        ownGoal: false,
        xg: r.xg,
      })),
    ];
    return result;
  }

  // ---------- Interrupciones ----------
  async addInterruption(matchId: number, dto: AddInterruptionDto) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('interruption_type', sql.NVarChar, dto.interruptionType)
      .input('minute_start', sql.SmallInt, dto.minuteStart ?? null)
      .input('minute_end', sql.SmallInt, dto.minuteEnd ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .input('reason', sql.NVarChar, dto.reason ?? null)
      .query(
        `INSERT INTO dbo.match_interruptions (match_id, interruption_type, minute_start, minute_end, period, reason)
         OUTPUT INSERTED.id
         VALUES (@match_id, @interruption_type, @minute_start, @minute_end, @period, @reason)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeInterruption(matchId: number, interruptionId: number) {
    await this.deleteOrThrow('dbo.match_interruptions', matchId, interruptionId, 'Interrupción no encontrada');
  }

  // ---------- Penales durante el partido (fallado/atajado — el convertido ya es un gol) ----------
  async addPenaltyKick(matchId: number, dto: AddPenaltyKickDto) {
    await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .input('player_id', sql.Int, dto.playerId)
      .input('team_id', sql.Int, dto.teamId)
      .input('outcome', sql.NVarChar, dto.outcome)
      .input('minute', sql.SmallInt, dto.minute ?? null)
      .input('minute_extra', sql.SmallInt, dto.minuteExtra ?? null)
      .input('period', sql.NVarChar, dto.period ?? null)
      .query(
        `INSERT INTO dbo.penalty_kicks (match_id, player_id, team_id, outcome, minute, minute_extra, period)
         OUTPUT INSERTED.id
         VALUES (@match_id, @player_id, @team_id, @outcome, @minute, @minute_extra, @period)`,
      );
    return { id: result.recordset[0].id };
  }

  async removePenaltyKick(matchId: number, penaltyId: number) {
    await this.deleteOrThrow('dbo.penalty_kicks', matchId, penaltyId, 'Penal no encontrado');
  }

  // ---------- Tanda de penales (deliberadamente separada del resultado normal) ----------
  async listShootoutKicks(matchId: number) {
    const result = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT k.id, k.team_id, t.name AS team_name, k.player_id, p.full_name AS player_name,
                k.kick_order, k.outcome
         FROM dbo.match_shootout_kicks k
         JOIN dbo.teams t ON t.id = k.team_id
         LEFT JOIN dbo.players p ON p.id = k.player_id
         WHERE k.match_id = @match_id
         ORDER BY k.kick_order`,
      );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      playerId: r.player_id,
      playerName: r.player_name,
      kickOrder: r.kick_order,
      outcome: r.outcome,
    }));
  }

  async addShootoutKick(matchId: number, dto: AddShootoutKickDto) {
    if (dto.playerId) await this.assertLineupMembership(matchId, dto.teamId, dto.playerId);
    try {
      const result = await this.pool
        .request()
        .input('match_id', sql.Int, matchId)
        .input('team_id', sql.Int, dto.teamId)
        .input('player_id', sql.Int, dto.playerId ?? null)
        .input('kick_order', sql.SmallInt, dto.kickOrder)
        .input('outcome', sql.NVarChar, dto.outcome)
        .query(
          `INSERT INTO dbo.match_shootout_kicks (match_id, team_id, player_id, kick_order, outcome)
           OUTPUT INSERTED.id
           VALUES (@match_id, @team_id, @player_id, @kick_order, @outcome)`,
        );
      return { id: result.recordset[0].id };
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        throw new BadRequestException('Ya existe un lanzamiento con ese número de orden para ese equipo');
      }
      throw err;
    }
  }

  async removeShootoutKick(matchId: number, kickId: number) {
    await this.deleteOrThrow('dbo.match_shootout_kicks', matchId, kickId, 'Lanzamiento no encontrado');
  }

  // ---------- Timeline unificado (sólo lectura — junta goles/tarjetas/sustituciones/
  // offsides/faltas/interrupciones en un único orden cronológico para la pantalla del partido) ----------
  async getTimeline(matchId: number) {
    const [goals, cards, subs, offsides, fouls, interruptions] = await Promise.all([
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT g.id, g.minute, g.minute_extra, g.period, g.team_id, t.name AS team_name,
                g.player_id, p.full_name AS player_name, g.assist_player_id,
                ap.full_name AS assist_player_name, g.own_goal, g.penalty, g.goal_type
         FROM dbo.goals g
         JOIN dbo.teams t ON t.id = g.team_id
         JOIN dbo.players p ON p.id = g.player_id
         LEFT JOIN dbo.players ap ON ap.id = g.assist_player_id
         WHERE g.match_id = @match_id`,
      ),
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT c.id, c.minute, c.minute_extra, c.period, c.team_id, t.name AS team_name,
                c.player_id, p.full_name AS player_name, c.card_type, c.reason
         FROM dbo.cards c
         JOIN dbo.teams t ON t.id = c.team_id
         JOIN dbo.players p ON p.id = c.player_id
         WHERE c.match_id = @match_id`,
      ),
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT s.id, s.minute, s.minute_extra, s.period, s.team_id, t.name AS team_name,
                s.player_out_id, po.full_name AS player_out_name,
                s.player_in_id, pi.full_name AS player_in_name, s.reason
         FROM dbo.substitutions s
         JOIN dbo.teams t ON t.id = s.team_id
         JOIN dbo.players po ON po.id = s.player_out_id
         JOIN dbo.players pi ON pi.id = s.player_in_id
         WHERE s.match_id = @match_id`,
      ),
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT o.id, o.minute, o.minute_extra, o.period, o.team_id, t.name AS team_name,
                o.player_id, p.full_name AS player_name
         FROM dbo.offsides o
         JOIN dbo.teams t ON t.id = o.team_id
         LEFT JOIN dbo.players p ON p.id = o.player_id
         WHERE o.match_id = @match_id`,
      ),
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT f.id, f.minute, f.minute_extra, f.period, f.team_id, t.name AS team_name,
                f.player_id, p.full_name AS player_name, f.note
         FROM dbo.fouls f
         JOIN dbo.teams t ON t.id = f.team_id
         LEFT JOIN dbo.players p ON p.id = f.player_id
         WHERE f.match_id = @match_id`,
      ),
      this.pool.request().input('match_id', sql.Int, matchId).query(
        `SELECT i.id, i.minute_start AS minute, i.minute_end, i.period, i.interruption_type, i.reason
         FROM dbo.match_interruptions i
         WHERE i.match_id = @match_id`,
      ),
    ]);

    const events: any[] = [];
    for (const r of goals.recordset) {
      events.push({
        type: 'goal',
        id: r.id,
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerId: r.player_id,
        playerName: r.player_name,
        assistPlayerId: r.assist_player_id,
        assistPlayerName: r.assist_player_name,
        ownGoal: !!r.own_goal,
        penalty: !!r.penalty,
        goalType: r.goal_type,
      });
    }
    for (const r of cards.recordset) {
      events.push({
        type: 'card',
        id: r.id,
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerId: r.player_id,
        playerName: r.player_name,
        cardType: r.card_type,
        reason: r.reason,
      });
    }
    for (const r of subs.recordset) {
      events.push({
        type: 'substitution',
        id: r.id,
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerOutId: r.player_out_id,
        playerOutName: r.player_out_name,
        playerInId: r.player_in_id,
        playerInName: r.player_in_name,
        reason: r.reason,
      });
    }
    for (const r of offsides.recordset) {
      events.push({
        type: 'offside',
        id: r.id,
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerId: r.player_id,
        playerName: r.player_name,
      });
    }
    for (const r of fouls.recordset) {
      events.push({
        type: 'foul',
        id: r.id,
        minute: r.minute,
        minuteExtra: r.minute_extra,
        period: r.period,
        teamId: r.team_id,
        teamName: r.team_name,
        playerId: r.player_id,
        playerName: r.player_name,
        reason: r.note,
      });
    }
    for (const r of interruptions.recordset) {
      events.push({
        type: 'interruption',
        id: r.id,
        minute: r.minute,
        minuteEnd: r.minute_end,
        period: r.period,
        interruptionType: r.interruption_type,
        reason: r.reason,
      });
    }

    events.sort((a, b) => {
      const am = a.minute ?? -1;
      const bm = b.minute ?? -1;
      if (am !== bm) return am - bm;
      return (a.minuteExtra ?? 0) - (b.minuteExtra ?? 0);
    });
    return events;
  }

  private async deleteOrThrow(table: string, matchId: number, id: number, notFoundMessage: string) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('match_id', sql.Int, matchId)
      .query(`DELETE FROM ${table} WHERE id = @id AND match_id = @match_id`);
    if (result.rowsAffected[0] === 0) {
      throw new NotFoundException(notFoundMessage);
    }
  }
}
