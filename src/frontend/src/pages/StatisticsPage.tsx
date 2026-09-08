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
} from '../components/stats/StatsCharts'
import { api } from '../services/api'
import type { Competition } from '../types/competition'
import type { Season } from '../types/season'

export default function StatisticsPage() {
  const navigate = useNavigate()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)

  useEffect(() => {
    api
      .get<Competition[]>('/competitions')
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
  }, [])

  useEffect(() => {
    setSeasonId(null)
    if (!competitionId) {
      setSeasons([])
      return
    }
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [competitionId])

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (competitionId) params.set('competitionId', String(competitionId))
    if (seasonId) params.set('seasonId', String(seasonId))
    return params.toString()
  }, [competitionId, seasonId])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">📊 Estadísticas</h1>
      <p className="mb-6 text-sm text-slate-500">
        Calculadas en tiempo real a partir de los partidos, goles y tarjetas registrados. Sin filtro
        de competición, se muestran todos los datos del sistema.
      </p>

      <div className="mb-6 flex flex-wrap gap-3 rounded-lg bg-white p-4 shadow">
        <select
          value={competitionId ?? ''}
          onChange={(e) => setCompetitionId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las competiciones</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={seasonId ?? ''}
          onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : null)}
          disabled={!competitionId}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">Todas las temporadas</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              Temporada {s.label}
            </option>
          ))}
        </select>
      </div>

      <OverviewCards query={query} extended={!!competitionId} />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Goles por equipo">
          <GoalsByTeamChart query={query} onTeamClick={(id) => navigate(`/equipos/${id}`)} />
        </ChartCard>
        <ChartCard title="Tarjetas por equipo">
          <CardsByTeamChart query={query} onTeamClick={(id) => navigate(`/equipos/${id}`)} />
        </ChartCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Partidos por estado">
          <MatchesByStatusChart query={query} />
        </ChartCard>
        {competitionId && (
          <ChartCard title="Evolución de goles por temporada">
            <GoalsBySeasonChart competitionId={competitionId} />
          </ChartCard>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopListCard title="Máximos goleadores" query={query} kind="scorers" onPlayerClick={(id) => navigate(`/jugadores/${id}`)} />
        <TopListCard title="Máximos asistentes" query={query} kind="assists" onPlayerClick={(id) => navigate(`/jugadores/${id}`)} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <p className="mb-1 font-medium text-slate-600">Qué no se muestra acá, y por qué</p>
        <p>
          Posesión, tiros, tiros a puerta, xG/xA y mapas de calor no aparecen porque hoy no hay datos
          reales cargados para esas métricas en ningún partido (dependen de estadísticas de equipo
          manuales o de un proveedor externo, ver módulo de Partidos). Se van a poder sumar acá el día
          que existan datos reales que graficar, sin inventar valores mientras tanto.
        </p>
      </div>
    </div>
  )
}
