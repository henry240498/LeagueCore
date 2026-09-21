import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import {
  CreateExerciseDto,
  CreateObjectiveDto,
  CreateTrainingDto,
  SetAttendanceDto,
  UpdateObjectiveDto,
} from './dto/operations.dto';

@Injectable()
export class OperationsService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  // ---------- Entrenamientos ----------
  async listTrainings(teamId?: number) {
    const request = this.pool.request();
    const where = teamId ? 'WHERE t.team_id = @team_id' : '';
    if (teamId) request.input('team_id', sql.Int, teamId);
    const result = await request.query(
      `SELECT t.*, tm.name AS team_name,
        (SELECT COUNT(*) FROM dbo.training_attendance a WHERE a.training_id = t.id) AS attendance_count
       FROM dbo.trainings t JOIN dbo.teams tm ON tm.id = t.team_id ${where}
       ORDER BY t.training_date DESC, t.id DESC`,
    );
    return result.recordset.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      trainingDate: r.training_date,
      durationMin: r.duration_min,
      objective: r.objective,
      loadLevel: r.load_level,
      performance: r.performance,
      notes: r.notes,
      videoUrl: r.video_url,
      attendanceCount: r.attendance_count,
    }));
  }

  async createTraining(dto: CreateTrainingDto) {
    await this.assertTeamExists(dto.teamId);
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, dto.teamId)
      .input('training_date', sql.Date, dto.trainingDate)
      .input('duration_min', sql.Int, dto.durationMin ?? null)
      .input('objective', sql.NVarChar, dto.objective ?? null)
      .input('load_level', sql.NVarChar, dto.loadLevel ?? null)
      .input('performance', sql.NVarChar, dto.performance ?? null)
      .input('notes', sql.NVarChar, dto.notes ?? null)
      .input('video_url', sql.NVarChar, dto.videoUrl ?? null)
      .query(
        `INSERT INTO dbo.trainings (team_id, training_date, duration_min, objective, load_level, performance, notes, video_url)
         OUTPUT INSERTED.id VALUES (@team_id, @training_date, @duration_min, @objective, @load_level, @performance, @notes, @video_url)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeTraining(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.trainings WHERE id = @id');
  }

  async getAttendance(trainingId: number) {
    const result = await this.pool
      .request()
      .input('training_id', sql.Int, trainingId)
      .query(
        `SELECT a.*, p.full_name AS player_name FROM dbo.training_attendance a
         JOIN dbo.players p ON p.id = a.player_id WHERE a.training_id = @training_id ORDER BY p.full_name`,
      );
    return result.recordset.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      status: r.status,
    }));
  }

  async setAttendance(trainingId: number, dto: SetAttendanceDto) {
    await this.pool
      .request()
      .input('training_id', sql.Int, trainingId)
      .input('player_id', sql.Int, dto.playerId)
      .input('status', sql.NVarChar, dto.status)
      .query(
        `MERGE dbo.training_attendance AS t
         USING (SELECT @training_id AS training_id, @player_id AS player_id) AS s
         ON t.training_id = s.training_id AND t.player_id = s.player_id
         WHEN MATCHED THEN UPDATE SET status = @status
         WHEN NOT MATCHED THEN INSERT (training_id, player_id, status) VALUES (@training_id, @player_id, @status);`,
      );
    return this.getAttendance(trainingId);
  }

  // ---------- Biblioteca de ejercicios ----------
  async listExercises(search?: string) {
    const request = this.pool.request();
    const where = search ? 'WHERE (name LIKE @search OR category LIKE @search)' : '';
    if (search) request.input('search', sql.NVarChar, `%${search}%`);
    const result = await request.query(`SELECT * FROM dbo.training_exercises ${where} ORDER BY name`);
    return result.recordset.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      objective: r.objective,
      ageGroup: r.age_group,
      durationMin: r.duration_min,
      playersCount: r.players_count,
      material: r.material,
      diagram: r.diagram,
      videoUrl: r.video_url,
      intensity: r.intensity,
    }));
  }

  async createExercise(dto: CreateExerciseDto) {
    const result = await this.pool
      .request()
      .input('name', sql.NVarChar, dto.name)
      .input('category', sql.NVarChar, dto.category ?? null)
      .input('objective', sql.NVarChar, dto.objective ?? null)
      .input('age_group', sql.NVarChar, dto.ageGroup ?? null)
      .input('duration_min', sql.Int, dto.durationMin ?? null)
      .input('players_count', sql.NVarChar, dto.playersCount ?? null)
      .input('material', sql.NVarChar, dto.material ?? null)
      .input('diagram', sql.NVarChar, dto.diagram ?? null)
      .input('video_url', sql.NVarChar, dto.videoUrl ?? null)
      .input('intensity', sql.NVarChar, dto.intensity ?? null)
      .query(
        `INSERT INTO dbo.training_exercises
          (name, category, objective, age_group, duration_min, players_count, material, diagram, video_url, intensity)
         OUTPUT INSERTED.id
         VALUES (@name, @category, @objective, @age_group, @duration_min, @players_count, @material, @diagram, @video_url, @intensity)`,
      );
    return { id: result.recordset[0].id };
  }

  async removeExercise(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.training_exercises WHERE id = @id');
  }

  // ---------- Objetivos ----------
  async listPlayerObjectives(playerId: number) {
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .query('SELECT * FROM dbo.player_objectives WHERE player_id = @player_id ORDER BY deadline, id');
    return result.recordset.map(toObjectiveCamel);
  }

  async createPlayerObjective(playerId: number, dto: CreateObjectiveDto) {
    await this.assertPlayerExists(playerId);
    const result = await this.pool
      .request()
      .input('player_id', sql.Int, playerId)
      .input('title', sql.NVarChar, dto.title)
      .input('target_value', sql.Decimal(10, 2), dto.targetValue ?? null)
      .input('current_value', sql.Decimal(10, 2), dto.currentValue ?? null)
      .input('deadline', sql.Date, dto.deadline ?? null)
      .input('status', sql.NVarChar, dto.status ?? 'EN_CURSO')
      .query(
        `INSERT INTO dbo.player_objectives (player_id, title, target_value, current_value, deadline, status)
         OUTPUT INSERTED.id VALUES (@player_id, @title, @target_value, @current_value, @deadline, @status)`,
      );
    return { id: result.recordset[0].id };
  }

  async updatePlayerObjective(id: number, dto: UpdateObjectiveDto) {
    await this.applyObjectiveUpdate('dbo.player_objectives', id, dto);
    return { id };
  }

  async removePlayerObjective(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.player_objectives WHERE id = @id');
  }

  async listTeamObjectives(teamId: number) {
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .query('SELECT * FROM dbo.team_objectives WHERE team_id = @team_id ORDER BY deadline, id');
    return result.recordset.map(toObjectiveCamel);
  }

  async createTeamObjective(teamId: number, dto: CreateObjectiveDto) {
    await this.assertTeamExists(teamId);
    const result = await this.pool
      .request()
      .input('team_id', sql.Int, teamId)
      .input('title', sql.NVarChar, dto.title)
      .input('target_value', sql.Decimal(10, 2), dto.targetValue ?? null)
      .input('current_value', sql.Decimal(10, 2), dto.currentValue ?? null)
      .input('deadline', sql.Date, dto.deadline ?? null)
      .input('status', sql.NVarChar, dto.status ?? 'EN_CURSO')
      .query(
        `INSERT INTO dbo.team_objectives (team_id, title, target_value, current_value, deadline, status)
         OUTPUT INSERTED.id VALUES (@team_id, @title, @target_value, @current_value, @deadline, @status)`,
      );
    return { id: result.recordset[0].id };
  }

  async updateTeamObjective(id: number, dto: UpdateObjectiveDto) {
    await this.applyObjectiveUpdate('dbo.team_objectives', id, dto);
    return { id };
  }

  async removeTeamObjective(id: number) {
    await this.pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.team_objectives WHERE id = @id');
  }

  // ---------- Análisis contextual (derivado, punto 24) ----------
  // Local/visitante + primeros/segundos tiempos, todo de datos reales.
  async getTeamContext(teamId: number) {
    await this.assertTeamExists(teamId);
    const req = () => this.pool.request().input('team_id', sql.Int, teamId);
    const finished = `m.status = 'finished'`;
    const home = await req().query(
      `SELECT COUNT(*) AS p,
         SUM(CASE WHEN ps.home_score > ps.away_score THEN 1 ELSE 0 END) AS w,
         SUM(CASE WHEN ps.home_score = ps.away_score THEN 1 ELSE 0 END) AS d,
         SUM(CASE WHEN ps.home_score < ps.away_score THEN 1 ELSE 0 END) AS l,
         SUM(ps.home_score) AS gf, SUM(ps.away_score) AS ga
       FROM dbo.matches m LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
       WHERE m.home_team_id = @team_id AND ${finished}`,
    );
    const away = await req().query(
      `SELECT COUNT(*) AS p,
         SUM(CASE WHEN ps.away_score > ps.home_score THEN 1 ELSE 0 END) AS w,
         SUM(CASE WHEN ps.away_score = ps.home_score THEN 1 ELSE 0 END) AS d,
         SUM(CASE WHEN ps.away_score < ps.home_score THEN 1 ELSE 0 END) AS l,
         SUM(ps.away_score) AS gf, SUM(ps.home_score) AS ga
       FROM dbo.matches m LEFT JOIN dbo.match_period_scores ps ON ps.match_id = m.id AND ps.period = 'full_time'
       WHERE m.away_team_id = @team_id AND ${finished}`,
    );
    const halves = await req().query(
      `SELECT
         SUM(CASE WHEN g.period = 'first_half' AND g.team_id = @team_id THEN 1 ELSE 0 END) AS gf_1t,
         SUM(CASE WHEN g.period = 'first_half' AND g.team_id <> @team_id THEN 1 ELSE 0 END) AS ga_1t,
         SUM(CASE WHEN g.period = 'second_half' AND g.team_id = @team_id THEN 1 ELSE 0 END) AS gf_2t,
         SUM(CASE WHEN g.period = 'second_half' AND g.team_id <> @team_id THEN 1 ELSE 0 END) AS ga_2t,
         SUM(CASE WHEN g.period = 'second_half' AND g.minute >= 75 AND g.team_id = @team_id THEN 1 ELSE 0 END) AS gf_last15,
         SUM(CASE WHEN g.period = 'second_half' AND g.minute >= 75 AND g.team_id <> @team_id THEN 1 ELSE 0 END) AS ga_last15
       FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id
       WHERE (m.home_team_id = @team_id OR m.away_team_id = @team_id) AND ${finished}`,
    );
    return {
      home: home.recordset[0],
      away: away.recordset[0],
      halves: halves.recordset[0],
    };
  }

  // ---------- Impacto de sustituciones (punto 25) ----------
  async getSubImpact(matchId: number) {
    const subs = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query(
        `SELECT s.id, s.team_id, t.name AS team_name, s.minute, s.minute_extra,
           po.full_name AS out_name, pi.full_name AS in_name
         FROM dbo.substitutions s
         JOIN dbo.teams t ON t.id = s.team_id
         LEFT JOIN dbo.players po ON po.id = s.player_out_id
         LEFT JOIN dbo.players pi ON pi.id = s.player_in_id
         WHERE s.match_id = @match_id ORDER BY s.minute, s.id`,
      );
    const goals = await this.pool
      .request()
      .input('match_id', sql.Int, matchId)
      .query('SELECT team_id, minute, minute_extra FROM dbo.goals WHERE match_id = @match_id');
    return subs.recordset.map((s) => {
      const at = (s.minute ?? 0) * 60 + (s.minute_extra ?? 0);
      let gfBefore = 0;
      let gaBefore = 0;
      let gfAfter = 0;
      let gaAfter = 0;
      for (const g of goals.recordset) {
        const gt = (g.minute ?? 0) * 60 + (g.minute_extra ?? 0);
        const mine = g.team_id === s.team_id;
        if (gt <= at) {
          if (mine) gfBefore += 1;
          else gaBefore += 1;
        } else {
          if (mine) gfAfter += 1;
          else gaAfter += 1;
        }
      }
      return {
        id: s.id,
        teamId: s.team_id,
        teamName: s.team_name,
        minute: s.minute,
        outName: s.out_name,
        inName: s.in_name,
        scoreBefore: `${gfBefore}-${gaBefore}`,
        scoreAfter: `${gfAfter}-${gaAfter}`,
      };
    });
  }

  // ---------- Disciplina + árbitros (puntos 26-27) ----------
  async getDiscipline(teamId?: number) {
    const request = this.pool.request();
    const teamJoin = teamId ? 'AND (p.team_id = @team_id)' : '';
    if (teamId) request.input('team_id', sql.Int, teamId);
    const result = await request.query(
      `SELECT p.id, p.full_name, t.name AS team_name,
         (SELECT COUNT(*) FROM dbo.fouls f WHERE f.player_id = p.id) AS fouls,
         (SELECT COUNT(*) FROM dbo.cards c WHERE c.player_id = p.id AND c.card_type IN ('yellow','second_yellow')) AS yellows,
         (SELECT COUNT(*) FROM dbo.cards c WHERE c.player_id = p.id AND c.card_type = 'red') AS reds
       FROM dbo.players p LEFT JOIN dbo.teams t ON t.id = p.team_id
       WHERE p.status = 'active' ${teamJoin}
       ORDER BY yellows DESC, fouls DESC`,
    );
    return result.recordset.map((r) => ({
      playerId: r.id,
      playerName: r.full_name,
      teamName: r.team_name,
      fouls: r.fouls,
      yellows: r.yellows,
      reds: r.reds,
      suspensionRisk: r.yellows >= 3 || r.reds > 0,
    }));
  }

  async getRefereeStats() {
    const result = await this.pool.query(
      `SELECT o.id, o.full_name,
         (SELECT COUNT(*) FROM dbo.match_officials mo WHERE mo.official_id = o.id) AS matches,
         (SELECT COUNT(*) FROM dbo.cards c JOIN dbo.match_officials mo ON mo.match_id = c.match_id
            WHERE mo.official_id = o.id AND c.card_type IN ('yellow','second_yellow')) AS yellows,
         (SELECT COUNT(*) FROM dbo.cards c JOIN dbo.match_officials mo ON mo.match_id = c.match_id
            WHERE mo.official_id = o.id AND c.card_type = 'red') AS reds,
         (SELECT COUNT(*) FROM dbo.fouls f JOIN dbo.match_officials mo ON mo.match_id = f.match_id
            WHERE mo.official_id = o.id) AS fouls
       FROM dbo.officials o ORDER BY matches DESC`,
    );
    return result.recordset.map((r) => ({
      officialId: r.id,
      officialName: r.full_name,
      matches: r.matches,
      yellowsPerMatch: r.matches ? Math.round((r.yellows / r.matches) * 100) / 100 : 0,
      reds: r.reds,
      foulsPerMatch: r.matches ? Math.round((r.fouls / r.matches) * 100) / 100 : 0,
    }));
  }

  // ---------- Alertas (punto 43) ----------
  async listAlerts(status?: string) {
    const request = this.pool.request();
    const where = status ? 'WHERE status = @status' : '';
    if (status) request.input('status', sql.NVarChar, status);
    const result = await request.query(`SELECT * FROM dbo.alerts ${where} ORDER BY created_at DESC`);
    return result.recordset.map((r) => ({
      id: r.id,
      kind: r.kind,
      entityType: r.entity_type,
      entityId: r.entity_id,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  async resolveAlert(id: number, status: 'LEIDA' | 'RESUELTA') {
    // La tabla sólo admite PENDIENTE/LEIDA/RESUELTA (CK_al_status); un valor inválido daba 500.
    if (status !== 'LEIDA' && status !== 'RESUELTA') {
      throw new BadRequestException("Estado inválido: usá 'LEIDA' o 'RESUELTA'");
    }
    const result = await this.pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar, status)
      .query('UPDATE dbo.alerts SET status = @status WHERE id = @id');
    if (result.rowsAffected[0] === 0) throw new NotFoundException('Alerta no encontrada');
    return { id };
  }

  // Reglas reales sobre datos reales: lesiones activas, contratos por vencer, tarjetas al borde,
  // seguimientos vencidos y próximos partidos.
  async runAlertCheck() {
    const created: string[] = [];
    const insert = async (kind: string, entityType: string | null, entityId: number | null, message: string) => {
      const dup = await this.pool
        .request()
        .input('kind', sql.NVarChar, kind)
        .input('message', sql.NVarChar, message)
        .query(
          `SELECT TOP 1 1 FROM dbo.alerts WHERE kind = @kind AND message = @message AND status = 'PENDIENTE'`,
        );
      if (dup.recordset.length > 0) return;
      await this.pool
        .request()
        .input('kind', sql.NVarChar, kind)
        .input('entity_type', sql.NVarChar, entityType)
        .input('entity_id', sql.Int, entityId)
        .input('message', sql.NVarChar, message)
        .query(
          `INSERT INTO dbo.alerts (kind, entity_type, entity_id, message)
           VALUES (@kind, @entity_type, @entity_id, @message)`,
        );
      created.push(message);
    };

    const injuries = await this.pool.query(
      `SELECT i.player_id, p.full_name FROM dbo.player_injuries i
       JOIN dbo.players p ON p.id = i.player_id WHERE i.status = 'ACTIVA'`,
    );
    for (const r of injuries.recordset) {
      await insert('LESION', 'player', r.player_id, `🚑 ${r.full_name} está lesionado (baja activa)`);
    }
    const contracts = await this.pool.query(
      `SELECT id, full_name FROM dbo.players WHERE contract_status = 'POR_VENCER' AND status = 'active'`,
    );
    for (const r of contracts.recordset) {
      await insert('CONTRATO', 'player', r.id, `📄 Contrato por vencer: ${r.full_name}`);
    }
    const cards = await this.pool.query(
      `SELECT p.id, p.full_name, COUNT(*) AS yellows FROM dbo.cards c
       JOIN dbo.players p ON p.id = c.player_id
       WHERE c.card_type IN ('yellow','second_yellow') GROUP BY p.id, p.full_name HAVING COUNT(*) >= 3`,
    );
    for (const r of cards.recordset) {
      await insert('SANCION', 'player', r.id, `🟨 ${r.full_name} acumula ${r.yellows} amarillas (riesgo de suspensión)`);
    }
    const overdue = await this.pool.query(
      `SELECT w.id, COALESCE(p.full_name, w.external_name) AS name FROM dbo.watchlist w
       LEFT JOIN dbo.players p ON p.id = w.player_id
       WHERE w.next_observation IS NOT NULL AND w.next_observation < CAST(GETUTCDATE() AS DATE)
         AND w.status IN ('OBSERVADO','EN_SEGUIMIENTO')`,
    );
    for (const r of overdue.recordset) {
      await insert('SEGUIMIENTO', 'watchlist', r.id, `👀 Observación vencida: ${r.name}`);
    }
    const upcoming = await this.pool.query(
      `SELECT TOP 5 m.id, ht.name AS h, at.name AS a, m.match_date FROM dbo.matches m
       JOIN dbo.teams ht ON ht.id = m.home_team_id JOIN dbo.teams at ON at.id = m.away_team_id
       WHERE m.status = 'scheduled' AND m.match_date BETWEEN CAST(GETUTCDATE() AS DATE) AND DATEADD(day, 7, CAST(GETUTCDATE() AS DATE))`,
    );
    for (const r of upcoming.recordset) {
      await insert('PARTIDO', 'match', r.id, `📅 Próximo partido: ${r.h} vs ${r.a}`);
    }
    return { created: created.length, messages: created };
  }

  // ---------- Resumen operativo por rol (puntos 31-34, con roles admin/basico) ----------
  async getOverview(teamId?: number, playerId?: number) {
    const req = () => {
      const r = this.pool.request();
      if (teamId) r.input('team_id', sql.Int, teamId);
      return r;
    };
    const teamFilter = teamId ? 'WHERE team_id = @team_id' : '';
    const squad = Number(
      (await req().query(`SELECT COUNT(*) AS c FROM dbo.players ${teamId ? 'WHERE team_id = @team_id AND' : 'WHERE'} status = 'active'`)).recordset[0]?.c ?? 0,
    );
    const activeInjuries = Number(
      (
        await this.pool.query(
          `SELECT COUNT(*) AS c FROM dbo.player_injuries i JOIN dbo.players p ON p.id = i.player_id
           WHERE i.status = 'ACTIVA' ${teamId ? 'AND p.team_id = ' + Number(teamId) : ''}`,
        )
      ).recordset[0]?.c ?? 0,
    );
    const avgRating = Number(
      (
        await this.pool.query(
          `SELECT AVG(CAST(value AS FLOAT)) AS a FROM dbo.player_technical_ratings r
           JOIN dbo.players p ON p.id = r.player_id
           WHERE 1 = 1 ${teamId ? 'AND p.team_id = ' + Number(teamId) : ''}`,
        )
      ).recordset[0]?.a ?? 0,
    );
    const goalsXg = await this.pool.query(
      `SELECT (SELECT COUNT(*) FROM dbo.goals g JOIN dbo.matches m ON m.id = g.match_id ${teamId ? 'WHERE g.team_id = ' + Number(teamId) : ''}) AS goals,
         (SELECT SUM(xg) FROM dbo.shots s JOIN dbo.matches m ON m.id = s.match_id ${teamId ? 'WHERE s.team_id = ' + Number(teamId) : ''}) AS xg`,
    );
    const watchPending = Number((await this.pool.query(`SELECT COUNT(*) AS c FROM dbo.watchlist WHERE status IN ('OBSERVADO','EN_SEGUIMIENTO')`)).recordset[0]?.c ?? 0);
    const alertsPending = Number((await this.pool.query(`SELECT COUNT(*) AS c FROM dbo.alerts WHERE status = 'PENDIENTE'`)).recordset[0]?.c ?? 0);
    const upcomingMatches = await this.pool.query(
      `SELECT TOP 5 m.id, ht.name AS home, at.name AS away, m.match_date FROM dbo.matches m
       JOIN dbo.teams ht ON ht.id = m.home_team_id JOIN dbo.teams at ON at.id = m.away_team_id
       WHERE m.status = 'scheduled' ORDER BY m.match_date`,
    );
    let playerSection = null;
    if (playerId) {
      const p = await this.pool
        .request()
        .input('id', sql.Int, playerId)
        .query(
          `SELECT p.full_name,
            (SELECT COUNT(*) FROM dbo.goals g WHERE g.player_id = p.id) AS goals,
            (SELECT COUNT(*) FROM dbo.goals g WHERE g.assist_player_id = p.id) AS assists,
            (SELECT COUNT(DISTINCT match_id) FROM dbo.match_lineups WHERE player_id = p.id) AS matches,
            (SELECT COUNT(*) FROM dbo.player_objectives WHERE player_id = p.id AND status = 'EN_CURSO') AS objectives
           FROM dbo.players p WHERE p.id = @id`,
        );
      playerSection = p.recordset[0] ?? null;
    }
    return {
      squad,
      availabilityPct: squad ? Math.round(((squad - activeInjuries) / squad) * 100) : 100,
      activeInjuries,
      avgTech: Math.round(avgRating * 10) / 10,
      goals: Number(goalsXg.recordset[0]?.goals ?? 0),
      xg: Math.round(Number(goalsXg.recordset[0]?.xg ?? 0) * 100) / 100,
      watchPending,
      alertsPending,
      upcomingMatches: upcomingMatches.recordset,
      player: playerSection,
      teamFilter,
    };
  }

  private async applyObjectiveUpdate(table: string, id: number, dto: UpdateObjectiveDto) {
    const request = this.pool.request();
    const sets: string[] = [];
    if (dto.currentValue !== undefined) {
      request.input('current_value', sql.Decimal(10, 2), dto.currentValue);
      sets.push('current_value = @current_value');
    }
    if (dto.status) {
      request.input('status', sql.NVarChar, dto.status);
      sets.push('status = @status');
    }
    if (sets.length === 0) return;
    sets.push('updated_at = SYSUTCDATETIME()');
    request.input('id', sql.Int, id);
    await request.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = @id`);
  }

  private async assertTeamExists(teamId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, teamId)
      .query('SELECT TOP 1 1 FROM dbo.teams WHERE id = @id');
    if (result.recordset.length === 0) throw new BadRequestException('El equipo indicado no existe');
  }

  private async assertPlayerExists(playerId: number) {
    const result = await this.pool
      .request()
      .input('id', sql.Int, playerId)
      .query('SELECT TOP 1 1 FROM dbo.players WHERE id = @id');
    if (result.recordset.length === 0) throw new NotFoundException('Jugador no encontrado');
  }
}

function toObjectiveCamel(r: Record<string, any>) {
  return {
    id: r.id,
    title: r.title,
    targetValue: r.target_value === null ? null : Number(r.target_value),
    currentValue: r.current_value === null ? null : Number(r.current_value),
    deadline: r.deadline,
    status: r.status,
  };
}
