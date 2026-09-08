import { Inject, Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { SQL_POOL } from '../database/database.module';

export interface SearchResult {
  type: 'competition' | 'team' | 'player' | 'official' | 'coach' | 'season' | 'match';
  id: number;
  label: string;
  sublabel: string | null;
}

const PER_TYPE_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(@Inject(SQL_POOL) private readonly pool: sql.ConnectionPool) {}

  async search(q: string): Promise<SearchResult[]> {
    const term = `%${q}%`;
    const request = () => this.pool.request().input('q', sql.NVarChar, term).input('limit', sql.Int, PER_TYPE_LIMIT);

    const [competitions, teams, players, officials, coaches, seasons, matches] = await Promise.all([
      request().query(
        `SELECT TOP (@limit) id, name FROM dbo.competitions WHERE name LIKE @q ORDER BY name`,
      ),
      // Un club es una entidad independiente, no "pertenece" a una sola competición (§21 del
      // pedido de corrección arquitectónica) -- antes esto era un JOIN obligatorio contra
      // dbo.competitions, así que un equipo sin competición fija cargada ni siquiera aparecía en
      // la búsqueda. Ahora el sub-label es la ciudad (dato real y propio del club), nunca una
      // competición prestada.
      request().query(`SELECT TOP (@limit) t.id, t.name, t.city FROM dbo.teams t WHERE t.name LIKE @q ORDER BY t.name`),
      request().query(
        `SELECT TOP (@limit) id, full_name, position FROM dbo.players WHERE full_name LIKE @q ORDER BY full_name`,
      ),
      request().query(
        `SELECT TOP (@limit) o.id, o.full_name, ot.name AS type_name
         FROM dbo.officials o LEFT JOIN dbo.official_types ot ON ot.id = o.official_type_id
         WHERE o.full_name LIKE @q ORDER BY o.full_name`,
      ),
      request().query(`SELECT TOP (@limit) id, full_name FROM dbo.coaches WHERE full_name LIKE @q ORDER BY full_name`),
      request().query(
        `SELECT TOP (@limit) s.id, s.label, c.name AS competition_name
         FROM dbo.seasons s JOIN dbo.competitions c ON c.id = s.competition_id
         WHERE s.label LIKE @q OR c.name LIKE @q ORDER BY s.start_year DESC`,
      ),
      request().query(
        `SELECT TOP (@limit) m.id, m.match_date, ht.name AS home_team_name, at.name AS away_team_name
         FROM dbo.matches m
         JOIN dbo.teams ht ON ht.id = m.home_team_id
         JOIN dbo.teams at ON at.id = m.away_team_id
         WHERE ht.name LIKE @q OR at.name LIKE @q OR m.round LIKE @q OR m.phase LIKE @q
         ORDER BY m.match_date DESC`,
      ),
    ]);

    const results: SearchResult[] = [
      ...competitions.recordset.map((r) => ({ type: 'competition' as const, id: r.id, label: r.name, sublabel: 'Competición' })),
      ...teams.recordset.map((r) => ({ type: 'team' as const, id: r.id, label: r.name, sublabel: r.city ?? 'Equipo' })),
      ...players.recordset.map((r) => ({ type: 'player' as const, id: r.id, label: r.full_name, sublabel: r.position ?? 'Jugador' })),
      ...officials.recordset.map((r) => ({ type: 'official' as const, id: r.id, label: r.full_name, sublabel: r.type_name ?? 'Oficial' })),
      ...coaches.recordset.map((r) => ({ type: 'coach' as const, id: r.id, label: r.full_name, sublabel: 'Entrenador' })),
      ...seasons.recordset.map((r) => ({
        type: 'season' as const,
        id: r.id,
        label: `Temporada ${r.label}`,
        sublabel: r.competition_name,
      })),
      ...matches.recordset.map((r) => ({
        type: 'match' as const,
        id: r.id,
        label: `${r.home_team_name} vs ${r.away_team_name}`,
        sublabel: r.match_date ? new Date(r.match_date).toISOString().slice(0, 10) : null,
      })),
    ];

    return results;
  }
}
