import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import StandingsTable from '../../components/StandingsTable'
import StatusBadge from '../../components/StatusBadge'
import { ApiError } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { Competition } from '../../types/competition'
import type { Match } from '../../types/match'
import { MATCH_STATUS_LABELS } from '../../types/match'
import type { Player } from '../../types/player'
import type { Season } from '../../types/season'
import type { Team } from '../../types/team'
import CompetitionReportsTab from './CompetitionReportsTab'
import CompetitionStatsTab from './CompetitionStatsTab'

type Tab = 'info' | 'temporadas' | 'equipos' | 'jugadores' | 'partidos' | 'clasificacion' | 'estadisticas' | 'reportes'

const TABS: { key: Tab; label: string; ready: boolean }[] = [
  { key: 'info', label: 'Información general', ready: true },
  { key: 'temporadas', label: 'Temporadas', ready: true },
  { key: 'equipos', label: 'Equipos', ready: true },
  { key: 'jugadores', label: 'Jugadores', ready: true },
  { key: 'partidos', label: 'Partidos', ready: true },
  { key: 'clasificacion', label: 'Clasificación', ready: true },
  { key: 'estadisticas', label: 'Estadísticas', ready: true },
  { key: 'reportes', label: 'Reportes', ready: true },
]

export default function CompetitionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Competition>(`/competitions/${id}`)
      .then(setCompetition)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar la competición'))
  }, [id])

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>
  if (!competition) return <p className="p-8 text-center text-slate-500">Cargando...</p>

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">🏆 {competition.name}</h1>
          <p className="text-sm text-slate-500">
            {competition.sport}
            {competition.seasonYear ? ` · ${competition.seasonYear}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/competiciones/${id}/editar`)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Editar
        </button>
      </div>

      <div className="mb-6 mt-4 flex gap-2 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && <InfoTab competition={competition} />}
      {tab === 'temporadas' && <SeasonsTab competitionId={competition.id} />}
      {tab === 'equipos' && <TeamsTab competitionId={competition.id} />}
      {tab === 'jugadores' && <PlayersTab competitionId={competition.id} />}
      {tab === 'partidos' && <MatchesTab competitionId={competition.id} />}
      {tab === 'clasificacion' && <ClasificacionTab competitionId={competition.id} />}
      {tab === 'estadisticas' && <CompetitionStatsTab competitionId={competition.id} />}
      {tab === 'reportes' && <CompetitionReportsTab competitionId={competition.id} competitionName={competition.name} />}
    </div>
  )
}

function InfoTab({ competition: c }: { competition: Competition }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tipo" value={c.competitionType} />
        <Field label="País" value={c.country} />
        <Field label="Estado" value={c.status === 'active' ? 'Activa' : 'Inactiva'} />
        <Field label="Fecha de inicio" value={c.startDate?.slice(0, 10)} />
        <Field label="Fecha de fin" value={c.endDate?.slice(0, 10)} />
        <Field label="Organización" value={c.organization} />
        <Field label="Puntos (V/E/D)" value={`${c.pointsWin} / ${c.pointsDraw} / ${c.pointsLoss}`} />
      </dl>
      {c.description && (
        <div className="mt-4">
          <p className="text-sm text-slate-500">Descripción</p>
          <p className="text-slate-900">{c.description}</p>
        </div>
      )}
      {c.observations && (
        <div className="mt-4">
          <p className="text-sm text-slate-500">Observaciones</p>
          <p className="text-slate-900">{c.observations}</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || '—'}</dd>
    </div>
  )
}

function SeasonsTab({ competitionId }: { competitionId: number }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setSeasons(r.items))
      .catch(() => setSeasons([]))
  }, [competitionId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Temporadas</h2>
        <button
          type="button"
          onClick={() => navigate(`/temporadas/nueva?competitionId=${competitionId}`)}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Agregar temporada
        </button>
      </div>
      {!seasons && <p className="text-slate-500">Cargando...</p>}
      {seasons?.length === 0 && <p className="text-slate-500">Todavía no hay temporadas en esta competición.</p>}
      <ul className="divide-y divide-slate-100">
        {seasons?.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => navigate(`/temporadas/${s.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {s.label}
            </button>
            <div className="flex items-center gap-2">
              {s.isCurrent && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Actual</span>
              )}
              <StatusBadge status={s.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TeamsTab({ competitionId }: { competitionId: number }) {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<Team[]>(`/teams?competitionId=${competitionId}`).then(setTeams)
  }, [competitionId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Equipos</h2>
        <button
          type="button"
          onClick={() => navigate('/equipos/nuevo')}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Crear equipo nuevo
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Equipos que participaron en alguna temporada de esta competición. Un club es una entidad independiente: para sumar un
        equipo (nuevo o existente) a esta competición, agregalo desde la temporada correspondiente en la pestaña
        "Temporadas".
      </p>
      {!teams && <p className="text-slate-500">Cargando...</p>}
      {teams?.length === 0 && <p className="text-slate-500">Todavía no hay equipos en esta competición.</p>}
      <ul className="divide-y divide-slate-100">
        {teams?.map((t) => (
          <li key={t.id} className="py-2">
            <button
              type="button"
              onClick={() => navigate(`/equipos/${t.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {t.name}
            </button>
            {t.city && <span className="ml-2 text-sm text-slate-500">{t.city}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MatchesTab({ competitionId }: { competitionId: number }) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ items: Match[] }>(`/matches?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setMatches(r.items))
      .catch(() => setMatches([]))
  }, [competitionId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
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
      {matches?.length === 0 && <p className="text-slate-500">Todavía no hay partidos en esta competición.</p>}
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

function ClasificacionTab({ competitionId }: { competitionId: number }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)

  useEffect(() => {
    api
      .get<{ items: Season[] }>(`/seasons?competitionId=${competitionId}&pageSize=100`)
      .then((r) => {
        setSeasons(r.items)
        const current = r.items.find((s) => s.isCurrent) ?? r.items[0]
        setSeasonId(current?.id ?? null)
      })
      .catch(() => setSeasons([]))
  }, [competitionId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Clasificación</h2>
        {seasons && seasons.length > 0 && (
          <select
            value={seasonId ?? ''}
            onChange={(e) => setSeasonId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                Temporada {s.label}
                {s.isCurrent ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      {!seasons && <p className="text-slate-500">Cargando...</p>}
      {seasons && seasons.length === 0 && (
        <p className="text-slate-500">Esta competición todavía no tiene temporadas registradas.</p>
      )}
      {seasonId && <StandingsTable seasonId={seasonId} />}
    </div>
  )
}

function PlayersTab({ competitionId }: { competitionId: number }) {
  const [players, setPlayers] = useState<Player[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get<{ items: Player[] }>(`/players?competitionId=${competitionId}&pageSize=100`)
      .then((r) => setPlayers(r.items))
      .catch(() => setPlayers([]))
  }, [competitionId])

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-lg font-bold">Jugadores</h2>
      {!players && <p className="text-slate-500">Cargando...</p>}
      {players?.length === 0 && <p className="text-slate-500">Todavía no hay jugadores en esta competición.</p>}
      <ul className="divide-y divide-slate-100">
        {players?.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => navigate(`/jugadores/${p.id}`)}
              className="font-medium text-blue-600 hover:underline"
            >
              {p.fullName}
            </button>
            <span className="text-sm text-slate-500">
              {p.teamName}
              {p.position ? ` · ${p.position}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
