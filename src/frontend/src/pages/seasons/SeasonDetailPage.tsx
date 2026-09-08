import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import StandingsTable from '../../components/StandingsTable'
import StatusBadge from '../../components/StatusBadge'
import { CardsByTeamChart, ChartCard, GoalsByTeamChart, OverviewCards, TopListCard } from '../../components/stats/StatsCharts'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { Match } from '../../types/match'
import type { Season } from '../../types/season'
import type { Team } from '../../types/team'

export default function SeasonDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [season, setSeason] = useState<Season | null>(null)
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [teamToAdd, setTeamToAdd] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    api
      .get<Season>(`/seasons/${id}`)
      .then(setSeason)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la temporada'))
  }

  useEffect(load, [id])

  useEffect(() => {
    // Un club puede participar en cualquier competición/temporada -- la lista de candidatos para
    // agregar a esta temporada es todo el universo de equipos, no sólo los que ya jugaron antes en
    // esta competición.
    api.get<Team[]>('/teams').then(setAllTeams).catch(() => {})
  }, [])

  const handleToggleStatus = async () => {
    if (!season) return
    const next = season.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/seasons/${season.id}/status`, { status: next })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el estado')
    }
  }

  const handleToggleCurrent = async () => {
    if (!season) return
    try {
      await api.patch(`/seasons/${season.id}/current`, { isCurrent: !season.isCurrent })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al marcar la temporada actual')
    }
  }

  const handleDelete = async () => {
    if (!season) return
    if (
      !window.confirm(
        `¿Desea eliminar esta temporada?\n\n${season.label} — ${season.competitionName}\n\nEsta acción puede afectar información relacionada.`,
      )
    ) {
      return
    }
    try {
      await api.delete(`/seasons/${season.id}`)
      navigate('/temporadas')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    }
  }

  const handleAddTeam = async () => {
    if (!season || !teamToAdd) return
    setError('')
    try {
      await api.post(`/seasons/${season.id}/teams`, { teamId: Number(teamToAdd) })
      setTeamToAdd('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al agregar el equipo')
    }
  }

  const handleRemoveTeam = async (teamId: number) => {
    if (!season) return
    try {
      await api.delete(`/seasons/${season.id}/teams/${teamId}`)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al quitar el equipo')
    }
  }

  if (error && !season) return <p className="p-8 text-center text-red-600">{error}</p>
  if (!season) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  const availableTeams = allTeams.filter((t) => !season.teams?.some((st) => st.id === t.id))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">📅 Temporada {season.label}</h1>
              {season.isCurrent && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Actual
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/competiciones/${season.competitionId}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              {season.competitionName}
            </button>
            <div className="mt-1">
              <StatusBadge status={season.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/temporadas/${season.id}/editar`)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleToggleCurrent}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {season.isCurrent ? 'Desmarcar actual' : 'Marcar como actual'}
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {season.status === 'active' ? 'Finalizar' : 'Reactivar'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Información</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoField label="Competición" value={season.competitionName} />
          <InfoField label="Temporada" value={season.label} />
          <InfoField label="Fecha de inicio" value={season.startDate?.slice(0, 10)} />
          <InfoField label="Fecha de finalización" value={season.endDate?.slice(0, 10)} />
        </dl>
        {season.observations && (
          <div className="mt-4">
            <p className="text-sm text-slate-500">Observaciones</p>
            <p className="text-slate-900">{season.observations}</p>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold">Equipos participantes</h2>
        {(!season.teams || season.teams.length === 0) && (
          <p className="mb-4 text-slate-500">Todavía no hay equipos registrados en esta temporada.</p>
        )}
        {season.teams && season.teams.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {season.teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={() => navigate(`/equipos/${t.id}`)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {t.name}
                </button>
                <button type="button" onClick={() => handleRemoveTeam(t.id)} className="text-sm text-red-600 hover:underline">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-3">
          <select
            value={teamToAdd}
            onChange={(e) => setTeamToAdd(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">
              {availableTeams.length === 0 ? 'No hay más equipos para agregar' : 'Elegir equipo...'}
            </option>
            {availableTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddTeam}
            disabled={!teamToAdd}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            + Agregar
          </button>
        </div>
      </div>

      <StandingsSection seasonId={season.id} />

      <MatchesSection seasonId={season.id} />

      <SeasonStatsSection seasonId={season.id} />
    </div>
  )
}

// Reemplaza el placeholder "Información futura" (decía literalmente "--" para Jugadores/
// Oficiales/Estadísticas) por contenido real: los mismos componentes ya probados de Estadísticas
// de Competición, acá escopados a ESTA temporada puntual (query=seasonId=X).
function SeasonStatsSection({ seasonId }: { seasonId: number }) {
  const navigate = useNavigate()
  const query = `seasonId=${seasonId}`

  return (
    <div className="mb-6 space-y-6">
      <OverviewCards query={query} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Goles por equipo">
          <GoalsByTeamChart query={query} onTeamClick={(id) => navigate(`/equipos/${id}`)} />
        </ChartCard>
        <ChartCard title="Tarjetas por equipo">
          <CardsByTeamChart query={query} onTeamClick={(id) => navigate(`/equipos/${id}`)} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopListCard title="Goleadores" query={query} kind="scorers" onPlayerClick={(id) => navigate(`/jugadores/${id}`)} />
        <TopListCard title="Asistencias" query={query} kind="assists" onPlayerClick={(id) => navigate(`/jugadores/${id}`)} />
      </div>
    </div>
  )
}

function StandingsSection({ seasonId }: { seasonId: number }) {
  return (
    <div className="mb-6 rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Clasificación</h2>
      <StandingsTable seasonId={seasonId} />
    </div>
  )
}

function MatchesSection({ seasonId }: { seasonId: number }) {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<Match[] | null>(null)

  useEffect(() => {
    api
      .get<{ items: Match[] }>(`/matches?seasonId=${seasonId}&pageSize=100`)
      .then((r) => setMatches(r.items))
      .catch(() => setMatches([]))
  }, [seasonId])

  return (
    <div className="mb-6 rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Partidos</h2>
        <button
          type="button"
          onClick={() => navigate('/partidos/nuevo')}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Agregar partido
        </button>
      </div>
      {!matches && <p className="text-slate-500">Cargando...</p>}
      {matches?.length === 0 && <p className="text-slate-500">Todavía no hay partidos en esta temporada.</p>}
      <ul className="divide-y divide-slate-100">
        {matches?.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => navigate(`/partidos/${m.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {m.homeTeamName} {m.score ? `${m.score.homeScore}-${m.score.awayScore}` : 'vs'} {m.awayTeamName}
            </button>
            <span className="text-sm text-slate-500">
              {m.matchDate.slice(0, 10)} · {MATCH_STATUS_LABELS[m.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || '—'}</dd>
    </div>
  )
}

