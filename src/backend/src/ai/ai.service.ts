import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';
import { InsightsService } from '../insights/insights.service';

// Normaliza para los intents: minusculas + sin tildes.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9nñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Intent =
  | 'resumen_partido'
  | 'por_que_perdimos'
  | 'lesionados'
  | 'proximo_partido'
  | 'goleadores'
  | 'racha'
  | 'comparar'
  | 'buscar_jugador'
  | 'estado_marcador'
  | 'alertas'
  | 'ayuda'
  | 'desconocido';

export function detectIntent(question: string): Intent {
  const q = ` ${normalize(question)} `;
  const has = (...words: string[]) => words.some((w) => q.includes(` ${w} `) || q.includes(` ${w}`));
  if (has('ayuda', 'que puedes hacer', 'que sabes hacer', 'como funcionas')) return 'ayuda';
  if (has('por que perdimos', 'porque perdimos', 'perdimos', 'derrota', 'por que perdio')) return 'por_que_perdimos';
  // 'resum' cubre resumen / resume / resumí (voseo) / resumir.
  if (has('resum', 'cronica', 'como salio', 'como quedo', 'resultado')) return 'resumen_partido';
  if (has('lesionado', 'lesionados', 'baja', 'bajas', 'disponible', 'disponibles', 'enfermeria')) return 'lesionados';
  if (has('proximo partido', 'siguiente partido', 'cuando jugamos', 'proximo rival', 'que viene')) return 'proximo_partido';
  if (has('goleador', 'goleadores', 'quien marco', 'pichichi', 'maximo goleador')) return 'goleadores';
  if (has('racha', 'tendencia', 'como venimos', 'ultimos partidos', 'forma actual', 'rendimiento')) return 'racha';
  if (has('compara', 'comparar', ' versus ', ' vs ')) return 'comparar';
  if (has('cuando va perdiendo', 'cuando pierde', 'yendo perdiendo', 'cuando va ganando', 'yendo ganando', 'cuando empata', 'empatando', 'remonta', 'donde genera', 'donde ataca')) return 'estado_marcador';
  if (has('busco', 'buscar', 'necesito', 'quiero un', 'quiero una', 'fichar', 'extremo', 'delantero', 'arquero', 'portero', 'defensor', 'mediocampista', 'lateral')) return 'buscar_jugador';
  if (has('alerta', 'alertas', 'pendiente', 'atencion', 'revisar')) return 'alertas';
  return 'desconocido';
}

export function parseScoutingHints(question: string): { maxAge?: number; position?: string; minGoals?: number; minSpeed?: number } {
  const q = normalize(question);
  const hints: { maxAge?: number; position?: string; minGoals?: number; minSpeed?: number } = {};
  const ageMatch = q.match(/menor(?:es)? de (\d{2})|sub ?(\d{2})| (\d{2}) anos o menos/);
  if (ageMatch) hints.maxAge = Number(ageMatch[1] ?? ageMatch[2] ?? ageMatch[3]);
  if (q.includes('extremo')) hints.position = 'Delantero';
  else if (q.includes('delantero') || q.includes('nueve') || q.includes('goleador')) hints.position = 'Delantero';
  else if (q.includes('arquero') || q.includes('portero')) hints.position = 'Portero';
  else if (q.includes('defensor') || q.includes('central') || q.includes('lateral')) hints.position = 'Defensor';
  else if (q.includes('mediocampista') || q.includes('volante') || q.includes('mediocentro')) hints.position = 'Mediocampista';
  if (q.includes('goleador') || q.includes('goles')) hints.minGoals = 3;
  if (q.includes('rapido') || q.includes('veloz') || q.includes('velocidad')) hints.minSpeed = 80;
  return hints;
}

export interface AskResult {
  intent: Intent;
  answer: string;
  sources: { type: string; id: number | null }[];
}

@Injectable()
export class AiService {
  constructor(
    @Inject(SQL_POOL) private readonly pool: sql.ConnectionPool,
    private readonly insights: InsightsService,
  ) {}

  async ask(question: string, opts: { teamId?: number; matchId?: number; createdBy?: string } = {}): Promise<AskResult> {
    const intent = detectIntent(question);
    let result: AskResult;
    switch (intent) {
      case 'resumen_partido':
        result = await this.answerResumen(opts.matchId, opts.teamId);
        break;
      case 'por_que_perdimos':
        result = await this.answerPorQuePerdimos(opts.teamId);
        break;
      case 'lesionados':
        result = await this.answerLesionados(opts.teamId);
        break;
      case 'proximo_partido':
        result = await this.answerProximo(opts.teamId);
        break;
      case 'goleadores':
        result = await this.answerGoleadores(opts.teamId);
        break;
      case 'racha':
        result = await this.answerRacha(opts.teamId);
        break;
      case 'comparar':
        result = await this.answerComparar(question);
        break;
      case 'buscar_jugador':
        result = await this.answerBuscar(question);
        break;
      case 'estado_marcador':
        result = await this.answerEstado(question, opts.teamId, opts.matchId);
        break;
      case 'alertas':
        result = await this.answerAlertas();
        break;
      case 'ayuda':
        result = {
          intent,
          answer:
            'Puedo responder con datos reales del club:\n' +
            '• "Resumí el último partido" / "¿por qué perdimos?"\n' +
            '• "¿Quiénes están lesionados?" / "¿cuándo jugamos?"\n' +
            '• "Goleadores" / "¿cómo venimos? (racha)"\n' +
            '• "Compará A vs B" / "Busco un extremo menor de 23 años"\n' +
            '• "¿Cómo juega cuando va perdiendo?" (por estado del marcador)\n' +
            '• "¿Qué hay pendiente?" (alertas)\n' +
            'Pasame teamId para respuestas de tu equipo, o matchId para un partido puntual.',
          sources: [],
        };
        break;
      default:
        result = {
          intent: 'desconocido',
          answer: 'No entendí la pregunta con los datos que tengo. Probá con "ayuda" para ver qué puedo responder.',
          sources: [],
        };
    }
    await this.pool
      .request()
      .input('question', sql.NVarChar, question.slice(0, 1000))
      .input('intent', sql.NVarChar, result.intent)
      .input('answer', sql.NVarChar, result.answer.slice(0, 4000))
      .input('created_by', sql.NVarChar, opts.createdBy ?? null)
      .query('INSERT INTO dbo.ai_queries (question, intent, answer, created_by) VALUES (@question, @intent, @answer, @created_by)');
    return result;
  }

  async summarizeMatch(matchId: number): Promise<{ title: string; content: string }> {
    const m = await this.pool
      .request()
      .input('id', sql.Int, matchId)
      .query(
        `SELECT m.id, m.match_date, ht.name AS home_name, at.name AS away_name,
           (SELECT home_score FROM dbo.match_period_scores WHERE match_id = m.id AND period = 'full_time') AS hs,
           (SELECT away_score FROM dbo.match_period_scores WHERE match_id = m.id AND period = 'full_time') AS aws
         FROM dbo.matches m JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id WHERE m.id = @id`,
      );
    if (m.recordset.length === 0) return { title: 'Partido no encontrado', content: '' };
    const r = m.recordset[0];
    const req = () => this.pool.request().input('match_id', sql.Int, matchId);
    const goals = await req().query(
      `SELECT g.minute, p.full_name, t.name AS team_name, g.goal_type FROM dbo.goals g
       JOIN dbo.players p ON p.id = g.player_id JOIN dbo.teams t ON t.id = g.team_id ORDER BY g.minute`,
    );
    const shots = await req().query(
      `SELECT team_id, COUNT(*) AS c, SUM(xg) AS xg FROM dbo.shots WHERE match_id = @match_id GROUP BY team_id`,
    );
    const cards = await req().query(
      `SELECT COUNT(*) AS c FROM dbo.cards WHERE match_id = @match_id`,
    );
    const poss = await req().query(
      `SELECT team_id, COUNT(*) AS c, SUM(xg) AS xg FROM dbo.match_possessions WHERE match_id = @match_id GROUP BY team_id`,
    );
    const teamName = async (id: number) =>
      (await this.pool.request().input('id', sql.Int, id).query('SELECT name FROM dbo.teams WHERE id = @id')).recordset[0]?.name ?? `#${id}`;
    const lines = [
      `${r.home_name} ${r.hs ?? '?'} - ${r.aws ?? '?'} ${r.away_name}`,
      '',
      'GOLES',
      ...goals.recordset.map((g) => `• ${g.minute ?? '?'}′ ${g.full_name} (${g.team_name})${g.goal_type ? ` [${g.goal_type}]` : ''}`),
      '',
      'TIROS / xG POR EQUIPO',
    ];
    for (const s of shots.recordset) {
      lines.push(`• ${await teamName(s.team_id)}: ${s.c} tiros, xG ${Number(s.xg ?? 0).toFixed(2)}`);
    }
    lines.push('', `Tarjetas: ${cards.recordset[0]?.c ?? 0}`);
    if (poss.recordset.length) {
      lines.push('', 'POSESIONES REGISTRADAS');
      for (const p of poss.recordset) {
        lines.push(`• ${await teamName(p.team_id)}: ${p.c} posesiones, xG ${Number(p.xg ?? 0).toFixed(2)}`);
      }
    }
    // Tendencia simple: dónde se generó el peligro
    const zones = await req().query(
      `SELECT TOP 3 'ULTIMO_TERCIO' AS z, COUNT(*) AS c FROM dbo.shots WHERE match_id = @match_id AND pos_y >= 66.67`,
    );
    void zones;
    const content = lines.join('\n');
    return { title: `Resumen: ${r.home_name} vs ${r.away_name}`, content };
  }

  async trends(teamId?: number) {
    const teamFilter = teamId ? 'AND (m.home_team_id = @team_id OR m.away_team_id = @team_id)' : '';
    const request = this.pool.request();
    if (teamId) request.input('team_id', sql.Int, teamId);
    const last5 = await request.query(
      `SELECT TOP 5 m.id, m.match_date, ht.name AS h, at.name AS a,
         (SELECT home_score FROM dbo.match_period_scores WHERE match_id = m.id AND period = 'full_time') AS hs,
         (SELECT away_score FROM dbo.match_period_scores WHERE match_id = m.id AND period = 'full_time') AS aws,
         m.home_team_id, m.away_team_id
       FROM dbo.matches m JOIN dbo.teams ht ON ht.id = m.home_team_id JOIN dbo.teams at ON at.id = m.away_team_id
       WHERE m.status = 'finished' ${teamFilter} ORDER BY m.match_date DESC, m.id DESC`,
    );
    const rows = last5.recordset.map((m) => {
      let outcome: string | null = null;
      if (teamId && m.hs !== null && m.aws !== null) {
        const mine = m.home_team_id === teamId ? m.hs : m.aws;
        const theirs = m.home_team_id === teamId ? m.aws : m.hs;
        outcome = mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
      }
      return { matchId: m.id, date: m.match_date, label: `${m.h} ${m.hs ?? '?'}-${m.aws ?? '?'} ${m.a}`, outcome };
    });
    const seq = rows.map((r) => r.outcome).filter(Boolean).join('');
    let verdict = 'Sin datos suficientes.';
    if (seq.length >= 3) {
      const w = (seq.match(/W/g) || []).length;
      if (w >= 3) verdict = `Racha positiva (${seq}).`;
      else if ((seq.match(/L/g) || []).length >= 3) verdict = `Racha negativa (${seq}): revisar goles encajados y xG.`;
      else verdict = `Rendimiento mixto (${seq}).`;
    }
    return { matches: rows, verdict };
  }

  async listQueries(limit = 30) {
    const result = await this.pool
      .request()
      .input('n', sql.Int, Math.min(Math.max(limit, 1), 100))
      .query('SELECT TOP (@n) * FROM dbo.ai_queries ORDER BY created_at DESC');
    return result.recordset.map((r) => ({
      id: r.id,
      question: r.question,
      intent: r.intent,
      answer: r.answer,
      createdAt: r.created_at,
    }));
  }

  async saveReport(kind: string, title: string, content: string, entityType?: string, entityId?: number, createdBy?: string) {
    const result = await this.pool
      .request()
      .input('kind', sql.NVarChar, kind)
      .input('entity_type', sql.NVarChar, entityType ?? null)
      .input('entity_id', sql.Int, entityId ?? null)
      .input('title', sql.NVarChar, title)
      .input('content', sql.NVarChar, content)
      .input('created_by', sql.NVarChar, createdBy ?? null)
      .query(
        `INSERT INTO dbo.ai_reports (kind, entity_type, entity_id, title, content, created_by)
         OUTPUT INSERTED.id VALUES (@kind, @entity_type, @entity_id, @title, @content, @created_by)`,
      );
    return { id: result.recordset[0].id };
  }

  async listReports(kind?: string) {
    const request = this.pool.request();
    const where = kind ? 'WHERE kind = @kind' : '';
    if (kind) request.input('kind', sql.NVarChar, kind);
    const result = await request.query(`SELECT TOP 50 * FROM dbo.ai_reports ${where} ORDER BY created_at DESC`);
    return result.recordset;
  }

  // ---------- Intent handlers ----------
  private async lastFinishedMatch(teamId?: number) {
    const request = this.pool.request();
    const where = teamId ? 'AND (m.home_team_id = @team_id OR m.away_team_id = @team_id)' : '';
    if (teamId) request.input('team_id', sql.Int, teamId);
    const result = await request.query(
      `SELECT TOP 1 m.id, m.match_date, ht.name AS h, at.name AS a, m.home_team_id, m.away_team_id,
         (SELECT home_score FROM dbo.match_period_scores WHERE match_id = m.id AND period = 'full_time') AS hs,
         (SELECT away_score FROM dbo.match_period_scores WHERE match_id = m.id AND period = 'full_time') AS aws
       FROM dbo.matches m JOIN dbo.teams ht ON ht.id = m.home_team_id JOIN dbo.teams at ON at.id = m.away_team_id
       WHERE m.status = 'finished' ${where} ORDER BY m.match_date DESC, m.id DESC`,
    );
    return result.recordset[0] ?? null;
  }

  private async answerResumen(matchId?: number, teamId?: number): Promise<AskResult> {
    const id = matchId ?? (await this.lastFinishedMatch(teamId))?.id;
    if (!id) {
      return { intent: 'resumen_partido', answer: 'No hay partidos finalizados para resumir.', sources: [] };
    }
    const summary = await this.summarizeMatch(id);
    return { intent: 'resumen_partido', answer: `${summary.title}\n\n${summary.content}`, sources: [{ type: 'match', id }] };
  }

  private async answerPorQuePerdimos(teamId?: number): Promise<AskResult> {
    if (!teamId) {
      return { intent: 'por_que_perdimos', answer: 'Decime el equipo (teamId) para analizar la derrota.', sources: [] };
    }
    const m = await this.lastFinishedMatch(teamId);
    if (!m) return { intent: 'por_que_perdimos', answer: 'Sin partidos finalizados.', sources: [] };
    const mine = m.home_team_id === teamId ? m.hs : m.aws;
    const theirs = m.home_team_id === teamId ? m.aws : m.hs;
    if (mine === null || theirs === null) {
      return { intent: 'por_que_perdimos', answer: `El último partido (${m.h} vs ${m.a}) no tiene resultado cargado.`, sources: [{ type: 'match', id: m.id }] };
    }
    if (mine >= theirs) {
      return { intent: 'por_que_perdimos', answer: `El último partido no se perdió: ${m.h} ${m.hs}-${m.aws} ${m.a}.`, sources: [{ type: 'match', id: m.id }] };
    }
    const req = () => this.pool.request().input('match_id', sql.Int, m.id).input('team_id', sql.Int, teamId);
    const shots = await req().query('SELECT COUNT(*) AS c, SUM(xg) AS xg FROM dbo.shots WHERE match_id = @match_id AND team_id = @team_id');
    const shotsOpp = await req().query('SELECT COUNT(*) AS c, SUM(xg) AS xg FROM dbo.shots WHERE match_id = @match_id AND team_id <> @team_id');
    const late = await req().query(
      `SELECT COUNT(*) AS c FROM dbo.goals WHERE match_id = @match_id AND team_id <> @team_id AND minute >= 75`,
    );
    const cards = await req().query(`SELECT COUNT(*) AS c FROM dbo.cards WHERE match_id = @match_id AND team_id = @team_id`);
    const s = shots.recordset[0];
    const so = shotsOpp.recordset[0];
    const lines = [
      `${m.h} ${m.hs}-${m.aws} ${m.a}: se perdió por ${theirs - mine}.`,
      `• Ocasiones: ${s.c ?? 0} tiros propios (xG ${Number(s.xg ?? 0).toFixed(2)}) vs ${so.c ?? 0} del rival (xG ${Number(so.xg ?? 0).toFixed(2)}).`,
    ];
    if (Number(so.xg ?? 0) > Number(s.xg ?? 0) + 0.5) lines.push('• El rival generó más peligro: derrota esperable por xG.');
    else lines.push('• Por xG el partido estuvo parejo: la diferencia estuvo en la eficacia.');
    if (Number(late.recordset[0]?.c ?? 0) > 0) lines.push(`• Se encajaron ${late.recordset[0].c} gol(es) desde el 75′: cierre flojo.`);
    if (Number(cards.recordset[0]?.c ?? 0) >= 3) lines.push('• 3+ tarjetas propias: el partido se jugó al límite disciplinario.');
    return { intent: 'por_que_perdimos', answer: lines.join('\n'), sources: [{ type: 'match', id: m.id }] };
  }

  private async answerLesionados(teamId?: number): Promise<AskResult> {
    const request = this.pool.request();
    const join = teamId ? 'AND p.team_id = @team_id' : '';
    if (teamId) request.input('team_id', sql.Int, teamId);
    const result = await request.query(
      `SELECT p.full_name, i.injury_type, i.start_date FROM dbo.player_injuries i
       JOIN dbo.players p ON p.id = i.player_id WHERE i.status = 'ACTIVA' ${join} ORDER BY i.start_date`,
    );
    if (result.recordset.length === 0) {
      return { intent: 'lesionados', answer: 'Sin lesionados registrados. ✅', sources: [] };
    }
    const lines = ['Lesionados activos:', ...result.recordset.map((r) => `• ${r.full_name} — ${r.injury_type}`)];
    return { intent: 'lesionados', answer: lines.join('\n'), sources: [] };
  }

  private async answerProximo(teamId?: number): Promise<AskResult> {
    const request = this.pool.request();
    const where = teamId ? 'AND (m.home_team_id = @team_id OR m.away_team_id = @team_id)' : '';
    if (teamId) request.input('team_id', sql.Int, teamId);
    const result = await request.query(
      `SELECT TOP 1 m.id, m.match_date, ht.name AS h, at.name AS a FROM dbo.matches m
       JOIN dbo.teams ht ON ht.id = m.home_team_id JOIN dbo.teams at ON at.id = m.away_team_id
       WHERE m.status = 'scheduled' ${where} ORDER BY m.match_date`,
    );
    if (result.recordset.length === 0) {
      return { intent: 'proximo_partido', answer: 'No hay partidos programados.', sources: [] };
    }
    const r = result.recordset[0];
    return {
      intent: 'proximo_partido',
      answer: `Próximo: ${r.h} vs ${r.a} (${String(r.match_date).slice(0, 10)}). Mirá su scouting en /scouting/rivales.`,
      sources: [{ type: 'match', id: r.id }],
    };
  }

  private async answerGoleadores(teamId?: number): Promise<AskResult> {
    const request = this.pool.request();
    const where = teamId ? 'AND p.team_id = @team_id' : '';
    if (teamId) request.input('team_id', sql.Int, teamId);
    const result = await request.query(
      `SELECT TOP 5 p.full_name, COUNT(*) AS g FROM dbo.goals g
       JOIN dbo.players p ON p.id = g.player_id WHERE 1 = 1 ${where}
       GROUP BY p.full_name ORDER BY g DESC`,
    );
    if (result.recordset.length === 0) {
      return { intent: 'goleadores', answer: 'Sin goles registrados todavía.', sources: [] };
    }
    return {
      intent: 'goleadores',
      answer: 'Goleadores:\n' + result.recordset.map((r, i) => `${i + 1}. ${r.full_name} — ${r.g}`).join('\n'),
      sources: [],
    };
  }

  private async answerRacha(teamId?: number): Promise<AskResult> {
    const t = await this.trends(teamId);
    const lines = ['Últimos partidos:', ...t.matches.map((m) => `• ${m.label}${m.outcome ? ` [${m.outcome}]` : ''}`), '', t.verdict];
    return { intent: 'racha', answer: lines.join('\n'), sources: t.matches.map((m) => ({ type: 'match', id: m.matchId })) };
  }

  private async answerComparar(question: string): Promise<AskResult> {
    const parts = question.split(/\bvs\b|\bversus\b/i);
    if (parts.length < 2) {
      return { intent: 'comparar', answer: 'Formato: "compará Juan Pérez vs Pedro Gómez".', sources: [] };
    }
    const findId = async (name: string) => {
      const r = await this.pool
        .request()
        .input('search', sql.NVarChar, `%${name.trim()}%`)
        .query('SELECT TOP 1 id, full_name FROM dbo.players WHERE full_name LIKE @search');
      return r.recordset[0] ?? null;
    };
    const a = await findId(parts[0].replace(/compara|comparar/gi, ''));
    const b = await findId(parts[1]);
    if (!a || !b) {
      return { intent: 'comparar', answer: `No encontré a ambos: ${a ? a.full_name + ' ✅' : 'A ❌'} / ${b ? b.full_name + ' ✅' : 'B ❌'}.`, sources: [] };
    }
    const stats = async (id: number) =>
      (
        await this.pool.request().input('id', sql.Int, id).query(
          `SELECT (SELECT COUNT(*) FROM dbo.goals WHERE player_id = @id) AS g,
             (SELECT COUNT(*) FROM dbo.goals WHERE assist_player_id = @id) AS a,
             (SELECT AVG(CAST(value AS FLOAT)) FROM dbo.player_technical_ratings WHERE player_id = @id) AS t`,
        )
      ).recordset[0];
    const sa = await stats(a.id);
    const sb = await stats(b.id);
    const fmtN = (v: unknown) => (v === null || v === undefined ? '—' : String(Math.round(Number(v) * 10) / 10));
    return {
      intent: 'comparar',
      answer: `${a.full_name} vs ${b.full_name}:\n• Goles: ${sa.g} vs ${sb.g}\n• Asistencias: ${sa.a} vs ${sb.a}\n• Promedio técnico: ${fmtN(sa.t)} vs ${fmtN(sb.t)}\nDetalle con radar en /comparador.`,
      sources: [
        { type: 'player', id: a.id },
        { type: 'player', id: b.id },
      ],
    };
  }

  private async answerBuscar(question: string): Promise<AskResult> {
    const hints = parseScoutingHints(question);
    const applied: string[] = [];
    const request = this.pool.request();
    const conditions = [`p.status = 'active'`];
    if (hints.position) {
      request.input('position', sql.NVarChar, hints.position);
      conditions.push('p.position = @position');
      applied.push(`posición ${hints.position}`);
    }
    if (hints.maxAge !== undefined) {
      request.input('max_age', sql.Int, hints.maxAge);
      conditions.push('(p.date_of_birth IS NOT NULL AND DATEDIFF(year, p.date_of_birth, GETDATE()) <= @max_age)');
      applied.push(`edad ≤ ${hints.maxAge}`);
    }
    if (hints.minGoals !== undefined) {
      request.input('min_goals', sql.Int, hints.minGoals);
      conditions.push('(SELECT COUNT(*) FROM dbo.goals g WHERE g.player_id = p.id) >= @min_goals');
      applied.push('con gol');
    }
    if (hints.minSpeed !== undefined) {
      request.input('min_speed', sql.Int, hints.minSpeed);
      conditions.push(`(SELECT AVG(CAST(value AS FLOAT)) FROM dbo.player_technical_ratings r WHERE r.player_id = p.id AND r.attribute = 'VELOCIDAD') >= @min_speed`);
      applied.push('velocidad 80+');
    }
    const result = await request.query(
      `SELECT TOP 5 p.id, p.full_name, p.position, DATEDIFF(year, p.date_of_birth, GETDATE()) AS age,
         (SELECT COUNT(*) FROM dbo.goals g WHERE g.player_id = p.id) AS goals
       FROM dbo.players p WHERE ${conditions.join(' AND ')} ORDER BY goals DESC, p.full_name`,
    );
    if (result.recordset.length === 0) {
      return { intent: 'buscar_jugador', answer: `Sin candidatos con esos filtros (${applied.join(', ') || 'sin filtros'}).`, sources: [] };
    }
    const lines = [
      `Candidatos (${applied.join(', ')}):`,
      ...result.recordset.map((r) => `• ${r.full_name} — ${r.position ?? '?'}${r.age ? `, ${r.age} años` : ''}, ${r.goals} goles`),
    ];
    return {
      intent: 'buscar_jugador',
      answer: lines.join('\n'),
      sources: result.recordset.map((r) => ({ type: 'player', id: r.id })),
    };
  }

  // ¿Cómo juega según el estado del marcador? (punto 23: perdiendo/empatando/ganando)
  private async answerEstado(question: string, teamId?: number, matchId?: number): Promise<AskResult> {
    if (matchId && teamId) {
      const agg = await this.insights.getScoreState(matchId, teamId);
      const lines = ['En este partido:', ...(['GANANDO', 'EMPATANDO', 'PERDIENDO'] as const).map(
        (st) => `• ${st.charAt(0) + st.slice(1).toLowerCase()}: ${agg[st].shots} tiros, xG ${agg[st].xg} (${agg[st].minutes} min)`,
      )];
      return { intent: 'estado_marcador', answer: lines.join('\n'), sources: [{ type: 'match', id: matchId }] };
    }
    if (!teamId) {
      return { intent: 'estado_marcador', answer: 'Decime el equipo (y opcionalmente el partido) para analizar por estado del marcador.', sources: [] };
    }
    const prof = await this.insights.getTeamStateProfile(teamId);
    if (prof.matchesWithShots === 0) {
      return { intent: 'estado_marcador', answer: 'Sin tiros registrados para analizar por estado. Cargá tiros con minuto en los partidos.', sources: [] };
    }
    const lines = [
      `Perfil por estado (${prof.matchesWithShots} partidos con tiros):`,
      `• Ganando: ${prof.states.GANANDO.shots} tiros, xG ${prof.states.GANANDO.xg}`,
      `• Empatando: ${prof.states.EMPATANDO.shots} tiros, xG ${prof.states.EMPATANDO.xg}`,
      `• Perdiendo: ${prof.states.PERDIENDO.shots} tiros, xG ${prof.states.PERDIENDO.xg}`,
    ];
    const per = prof.states.PERDIENDO.shots + prof.states.PERDIENDO.xg;
    const gan = prof.states.GANANDO.shots + prof.states.GANANDO.xg;
    if (per > gan * 1.5) lines.push('Tiende a generar más cuando va perdiendo: equipo reactivo.');
    else if (gan > per * 1.5) lines.push('Genera más cuando va ganando: aprovecha espacios de contra.');
    else lines.push('Generación pareja en todos los estados.');
    void question;
    return { intent: 'estado_marcador', answer: lines.join('\n'), sources: [] };
  }

  private async answerAlertas(): Promise<AskResult> {
    const result = await this.pool.query(`SELECT TOP 10 message FROM dbo.alerts WHERE status = 'PENDIENTE' ORDER BY created_at DESC`);
    if (result.recordset.length === 0) {
      return { intent: 'alertas', answer: 'Sin alertas pendientes. Ejecutá el chequeo en /operativa si querés actualizar.', sources: [] };
    }
    return { intent: 'alertas', answer: 'Pendientes:\n' + result.recordset.map((r) => `• ${r.message}`).join('\n'), sources: [] };
  }
}
