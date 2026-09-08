import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CardsByTeamChart,
  ChartCard,
  GoalsBySeasonChart,
  GoalsByTeamChart,
  MatchesByStatusChart,
  OverviewCards,
  TopListCard,
} from '../../components/stats/StatsCharts'
import { api } from '../../services/api'
import type { Season } from '../../types/season'
import type { MatchExtremes, MatchStatsSummary, TeamCompetitionSummaryRow } from '../../types/stats'

type SortKey = 'won' | 'goalsFor' | 'goalsAgainst' | 'played'

// Centro de análisis de la competición (§1-11 del pedido) -- ensamblado casi enteramente a partir
// de endpoints de /stats que ya existían (overview/top-scorers/top-assists/goals-by-team/
// cards-by-team/goals-by-season, todos ya aceptaban competitionId/seasonId), más tres piezas
// realmente nuevas: match-stats-summary, match-extremes y teams-summary (ver stats.service.ts).
export default function CompetitionStatsTab({ competitionId }: { competitionId: number }) {
  const navigate = useNavigate()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonId, setSeasonId] = useState<number | null>(null)

  useEffect(() => {
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [competitionId])

  const query = useMemo(() => {
    const params = new URLSearchParams({ competitionId: String(competitionId) })
    if (seasonId) params.set('seasonId', String(seasonId))
    return params.toString()
  }, [competitionId, seasonId])

  return (
    <div className="space-y-6">
      {seasons.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow">
          <label className="text-xs font-medium text-slate-600">Temporada</label>
          <select
            value={seasonId ?? ''}
            onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                Temporada {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <OverviewCards query={query} extended />

      <MatchStatsPanel query={query} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Goles por equipo">
          <GoalsByTeamChart query={query} onTeamClick={(id) => navigate(`/equipos/${id}`)} />
        </ChartCard>
        <ChartCard title="Tarjetas por equipo">
          <CardsByTeamChart query={query} onTeamClick={(id) => navigate(`/equipos/${id}`)} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Partidos por estado">
          <MatchesByStatusChart query={query} />
        </ChartCard>
        {seasons.length > 1 && (
          <ChartCard title="Evolución de goles por temporada">
            <GoalsBySeasonChart competitionId={competitionId} />
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopListCard title="Goleadores" query={query} kind="scorers" onPlayerClick={(id) => navigate(`/jugadores/${id}`)} />
        <TopListCard title="Asistencias" query={query} kind="assists" onPlayerClick={(id) => navigate(`/jugadores/${id}`)} />
      </div>

      <TeamsSummaryTable competitionId={competitionId} seasonId={seasonId} onTeamClick={(id) => navigate(`/equipos/${id}`)} />

      <MatchExtremesPanel query={query} onMatchClick={(id) => navigate(`/partidos/${id}`)} />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <p className="mb-1 font-medium text-slate-600">Qué no se muestra acá, y por qué</p>
        <p>
          Posesión, tiros, xG/xA y mapas de calor no aparecen porque hoy no hay datos reales cargados
          para esas métricas en esta competición. Se calculan a partir de los partidos, goles y
          tarjetas realmente registrados — nunca se inventa un valor cuando el dato no existe.
        </p>
      </div>
    </div>
  )
}

function MatchStatsPanel({ query }: { query: string }) {
  const [data, setData] = useState<MatchStatsSummary | null>(null)
  useEffect(() => {
    setData(null)
    api.get<MatchStatsSummary>(`/stats/match-stats-summary?${query}`).then(setData).catch(() => setData(null))
  }, [query])

  if (!data) return null
  if (data.played === 0) return null

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Resultados de partidos</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Victorias locales" value={data.homeWins} />
        <Stat label="Empates" value={data.draws} />
        <Stat label="Victorias visitantes" value={data.awayWins} />
        <Stat label="Promedio de goles" value={data.avgGoalsPerMatch ?? '—'} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Goles como local: {data.goalsHome} · Goles como visitante: {data.goalsAway} · Partidos con resultado cargado: {data.played}
      </p>
    </div>
  )
}

function MatchExtremesPanel({ query, onMatchClick }: { query: string; onMatchClick: (id: number) => void }) {
  const [data, setData] = useState<MatchExtremes | null>(null)
  useEffect(() => {
    setData(null)
    api.get<MatchExtremes>(`/stats/match-extremes?${query}`).then(setData).catch(() => setData(null))
  }, [query])

  if (!data || (!data.biggestWin && !data.highestScoring && !data.lowestScoring)) return null

  const entries = [
    { label: 'Mayor goleada', entry: data.biggestWin },
    { label: 'Partido con más goles', entry: data.highestScoring },
    { label: 'Partido con menos goles', entry: data.lowestScoring },
  ].filter((e) => e.entry)

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Récords de partidos</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {entries.map(
          ({ label, entry }) =>
            entry && (
              <button
                key={label}
                type="button"
                onClick={() => onMatchClick(entry.matchId)}
                className="rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50"
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 font-medium text-slate-900">
                  {entry.homeTeamName} {entry.homeScore}-{entry.awayScore} {entry.awayTeamName}
                </p>
                <p className="text-xs text-slate-400">{new Date(entry.matchDate).toLocaleDateString('es-PY')}</p>
              </button>
            ),
        )}
      </div>
    </div>
  )
}

function TeamsSummaryTable({
  competitionId,
  seasonId,
  onTeamClick,
}: {
  competitionId: number
  seasonId: number | null
  onTeamClick: (id: number) => void
}) {
  const [rows, setRows] = useState<TeamCompetitionSummaryRow[] | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('won')

  useEffect(() => {
    setRows(null)
    const params = new URLSearchParams({ competitionId: String(competitionId) })
    if (seasonId) params.set('seasonId', String(seasonId))
    api
      .get<TeamCompetitionSummaryRow[]>(`/stats/teams-summary?${params}`)
      .then(setRows)
      .catch(() => setRows([]))
  }, [competitionId, seasonId])

  if (!rows) return null
  if (rows.length === 0) return null

  const sorted = [...rows].sort((a, b) => b[sortKey] - a[sortKey])

  return (
    <div className="overflow-x-auto rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Estadísticas por equipo</h2>
        <p className="text-xs text-slate-400">{seasonId ? 'Temporada seleccionada' : 'Histórico de todas las temporadas'}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2 pr-3">Equipo</th>
            {(
              [
                ['played', 'PJ'],
                ['won', 'PG'],
                ['drawn', 'PE'],
                ['lost', 'PP'],
                ['goalsFor', 'GF'],
                ['goalsAgainst', 'GC'],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <th key={key} className="cursor-pointer select-none py-2 pr-3 text-center" onClick={() => setSortKey(key)}>
                {label} {sortKey === key && '▾'}
              </th>
            ))}
            <th className="py-2 pr-3 text-center">DG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => (
            <tr key={r.teamId}>
              <td className="py-2 pr-3">
                <button type="button" onClick={() => onTeamClick(r.teamId)} className="font-medium text-blue-600 hover:underline">
                  {r.teamName}
                </button>
              </td>
              <td className="py-2 pr-3 text-center">{r.played}</td>
              <td className="py-2 pr-3 text-center">{r.won}</td>
              <td className="py-2 pr-3 text-center">{r.drawn}</td>
              <td className="py-2 pr-3 text-center">{r.lost}</td>
              <td className="py-2 pr-3 text-center">{r.goalsFor}</td>
              <td className="py-2 pr-3 text-center">{r.goalsAgainst}</td>
              <td className="py-2 pr-3 text-center">{r.goalsFor - r.goalsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
